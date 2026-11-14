"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { keyHeaders, useSavedKey } from "@/lib/client/key";
import { useLocalRun, writeLocalRun } from "@/lib/client/local-run";
import { errorMessage, readEvents } from "@/lib/client/stream";
import { VERDICT_LABEL } from "@/lib/evals";
import { timeAgo } from "@/lib/format";
import type { EvalRun, TestCase, TestResult } from "@/lib/types";
import { send } from "./api";
import { DeleteButton } from "./DeleteButton";

type RunEvent =
  | { type: "start"; total: number; mode: EvalRun["mode"]; model: string | null }
  | { type: "result"; result: TestResult }
  | { type: "done"; run: EvalRun; saved: boolean }
  | { type: "error"; message: string };

const passed = (r: TestResult) => r.verdict === "correct" || r.verdict === "declined_correctly";

interface Props {
  businessId: string;
  tests: TestCase[];
  runs: EvalRun[];
  readOnly: boolean;
}

export function QualityRunner({ businessId, tests, runs: savedRuns, readOnly }: Props) {
  const router = useRouter();
  const savedKey = useSavedKey();
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<{ mode: EvalRun["mode"]; model: string | null; results: TestResult[]; total: number; at: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // The read-only demo does not keep runs on the server, so the visitor's own
  // latest run is remembered in their browser and takes its place in the list.
  const localRun = useLocalRun(businessId);
  const mine = localRun && (!savedRuns[0] || localRun.createdAt > savedRuns[0].createdAt) ? localRun : null;
  const runs = mine ? [mine, ...savedRuns] : savedRuns;

  // Show the run in progress, or else the most recent saved one.
  const shown = live ?? (runs[0] ? { mode: runs[0].mode, model: runs[0].model, results: runs[0].results, total: runs[0].total, at: runs[0].createdAt } : null);
  const byTest = new Map(shown?.results.map((r) => [r.testCaseId, r]));
  const results = shown?.results ?? [];
  const pass = results.filter(passed).length;
  // The run to compare against: the newest one that is not the run on screen.
  const previous = (live ? runs : runs.slice(1)).find((r) => r.createdAt !== live?.at);

  async function run() {
    setRunning(true);
    setError(null);
    setLive({ mode: "search", model: null, results: [], total: tests.length, at: null });
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/evals/run", { method: "POST", headers: keyHeaders(savedKey), signal: controller.signal });
      if (!response.ok) throw new Error(await errorMessage(response));
      for await (const event of readEvents<RunEvent>(response)) {
        if (event.type === "start") setLive({ mode: event.mode, model: event.model, results: [], total: event.total, at: null });
        else if (event.type === "result") setLive((l) => l && { ...l, results: [...l.results, event.result] });
        else if (event.type === "error") throw new Error(event.message);
        else {
          setLive({ mode: event.run.mode, model: event.run.model, results: event.run.results, total: event.run.total, at: event.run.createdAt });
          if (event.saved) router.refresh();
          else writeLocalRun(businessId, event.run);
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "The run stopped unexpectedly.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <section className="panel run" aria-labelledby="run-title">
        <div className="run-head">
          <div>
            <h2 id="run-title">
              {shown && results.length ? (
                <>
                  <b>{pass}</b> of {running ? results.length : shown.total} passed
                </>
              ) : (
                "Not run yet"
              )}
            </h2>
            <p role="status">
              {running
                ? `Running question ${Math.min(results.length + 1, shown?.total ?? 0)} of ${shown?.total ?? 0}`
                : shown?.at
                  ? `Last run ${timeAgo(shown.at)}, ${shown.mode === "model" ? `answers written by ${shown.model}` : "search-only mode"}`
                  : "Run the tests to see how the assistant does on your own questions."}
              {!running && previous && shown && results.length > 0 && (
                <>
                  {" "}
                  The run before passed {previous.correct + previous.declinedCorrectly} of {previous.total}.
                </>
              )}
            </p>
          </div>
          <div className="run-actions">
            {running ? (
              <button type="button" className="button button-quiet" onClick={() => abort.current?.abort()}>
                Stop
              </button>
            ) : (
              <button type="button" className="button" onClick={() => void run()} disabled={tests.length === 0}>
                Run all {tests.length} tests
              </button>
            )}
          </div>
        </div>

        {shown && results.length > 0 && (
          <dl className="run-split">
            <div>
              <dt>Answered correctly</dt>
              <dd>{results.filter((r) => r.verdict === "correct").length}</dd>
            </div>
            <div>
              <dt>Declined correctly</dt>
              <dd>{results.filter((r) => r.verdict === "declined_correctly").length}</dd>
            </div>
            <div>
              <dt>Wrong or incomplete</dt>
              <dd>{results.filter((r) => !passed(r)).length}</dd>
            </div>
            <div>
              <dt>Unsupported claims</dt>
              <dd>{results.filter((r) => !r.grounded).length}</dd>
            </div>
          </dl>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {readOnly && (live?.at || mine) && !running && (
          <p className="dash-hint">This is the public demo, so your run is kept in this browser only.</p>
        )}
        <p className="dash-hint">
          {savedKey
            ? "Your AI key is set in this tab, so the model writes each answer and the run uses your credit."
            : "No AI key is set, so this run grades search-only answers and costs nothing. Add a key in Settings to grade a model."}
        </p>
      </section>

      <table className="table tests">
        <thead>
          <tr>
            <th scope="col">Test question</th>
            <th scope="col">Must contain</th>
            <th scope="col">Result</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {tests.map((test) => {
          const result = byTest.get(test.id);
          const expanded = open === test.id;
          return (
            <tbody key={test.id}>
              <tr data-pass={result ? passed(result) : undefined}>
                <th scope="row">{test.question}</th>
                <td>{test.shouldAnswer ? test.keyFacts.map((f) => f.split("|")[0]).join(", ") : <em>Should decline</em>}</td>
                <td>
                  {result ? (
                    <button type="button" className="verdict-button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : test.id)}>
                      <span className="verdict">{VERDICT_LABEL[result.verdict]}</span>
                      {!result.grounded && <span className="tag tag-warn">Unsupported claim</span>}
                    </button>
                  ) : (
                    <span className="pending">{running ? "Waiting" : "Not run"}</span>
                  )}
                </td>
                <td>
                  <DeleteButton url={`/api/tests/${test.id}`} label={`Delete test: ${test.question}`} confirm="Delete this test?" disabled={readOnly} />
                </td>
              </tr>
              {expanded && result && (
                <tr className="detail">
                  <td colSpan={4}>
                    <dl>
                      <div>
                        <dt>The assistant said</dt>
                        <dd className="said">{result.answer.replace(/\s*\[\d+\]/g, "")}</dd>
                      </div>
                      <div>
                        <dt>Expected</dt>
                        <dd>{test.expected || "No note."}</dd>
                      </div>
                      {result.missingFacts.length > 0 && (
                        <div>
                          <dt>Missing from the answer</dt>
                          <dd>{result.missingFacts.map((f) => f.split("|")[0]).join(", ")}</dd>
                        </div>
                      )}
                      {result.unsupported.length > 0 && (
                        <div>
                          <dt>Not backed by the sources</dt>
                          <dd>{result.unsupported.join(" ")}</dd>
                        </div>
                      )}
                      {result.sources.length > 0 && (
                        <div>
                          <dt>Source used</dt>
                          <dd>{result.sources.map((s) => `${s.documentTitle}${s.heading ? ` / ${s.heading}` : ""}`).join("; ")}</dd>
                        </div>
                      )}
                    </dl>
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
      {tests.length === 0 && <p className="empty">No test questions yet. Add the questions your customers ask most.</p>}

      <AddTest disabled={readOnly} />
    </>
  );
}

function AddTest({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [shouldAnswer, setShouldAnswer] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    start(async () => {
      const failed = await send("/api/tests", "POST", {
        question: data.get("question"),
        expected: data.get("expected"),
        keyFacts: String(data.get("keyFacts") ?? "").split(","),
        shouldAnswer,
      });
      setError(failed);
      if (!failed) {
        form.reset();
        setShouldAnswer(true);
        router.refresh();
      }
    });
  }

  return (
    <form className="panel add-test" onSubmit={submit} aria-labelledby="add-test-title">
      <h2 id="add-test-title">Add a test question</h2>
      <div className="field">
        <label htmlFor="t-question">Question, as a customer would ask it</label>
        <input id="t-question" name="question" required maxLength={500} placeholder="Can I return a sale item?" />
      </div>
      <fieldset className="field">
        <legend>What should the assistant do?</legend>
        <div className="choices">
          <label>
            <input type="radio" name="should" checked={shouldAnswer} onChange={() => setShouldAnswer(true)} />
            <span>
              <strong>Answer it</strong>The documents cover this
            </span>
          </label>
          <label>
            <input type="radio" name="should" checked={!shouldAnswer} onChange={() => setShouldAnswer(false)} />
            <span>
              <strong>Decline</strong>The documents do not cover this
            </span>
          </label>
        </div>
      </fieldset>
      {shouldAnswer && (
        <div className="field">
          <label htmlFor="t-facts">Facts the answer must contain</label>
          <input id="t-facts" name="keyFacts" required placeholder="30 days, receipt" />
          <p>Separate facts with commas. Write two accepted wordings as “30 days|one month”.</p>
        </div>
      )}
      <div className="field">
        <label htmlFor="t-expected">Note on the right answer (optional)</label>
        <input id="t-expected" name="expected" maxLength={1000} />
      </div>
      <div className="form-foot">
        <button className="button" type="submit" disabled={disabled || pending}>
          {pending ? "Adding" : "Add test"}
        </button>
        {disabled && <p>The demo is read-only, so this button is off.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </form>
  );
}
