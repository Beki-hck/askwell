import { answerQuestion } from "@/lib/answer";
import { isUuid, json, rateLimit, readJson, route, text } from "@/lib/http";
import { type ChatTurn, LlmError, llmFromHeaders, serverLlm } from "@/lib/llm";
import { getStore } from "@/lib/store";
import { StoreError } from "@/lib/types";

export const maxDuration = 60;

/**
 * Answers one visitor question. The reply is a stream of JSON lines:
 * `sources`, then `delta` pieces of text, then `done` with the saved ids.
 */
export const POST = route(async (request: Request) => {
  rateLimit(request, "chat", 20, 60_000);
  const body = await readJson(request);
  const slug = text(body.slug, "Business", 40);
  const question = text(body.question, "Question", 600);
  const conversationId = isUuid(body.conversationId) ? body.conversationId : null;
  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is ChatTurn =>
            !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string",
        )
        .slice(-6)
        .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }))
    : [];

  const store = await getStore();
  const business = await store.getBusiness(slug);
  if (!business) throw new StoreError("This assistant does not exist.", 404);
  if ((await store.questionsToday(business.id)) >= business.dailyLimit) {
    throw new StoreError("This assistant has reached its daily question limit. Try again tomorrow.", 429);
  }

  // A key the visitor pasted wins over the one configured on the server.
  const llm = llmFromHeaders(request.headers) ?? serverLlm();
  const passages = await store.search(business, question, 4);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for await (const event of answerQuestion({
          business,
          question,
          history,
          passages,
          llm,
          signal: request.signal,
        })) {
          if (event.type !== "done") {
            send(event);
            continue;
          }
          const saved = await store.logExchange(business, {
            conversationId,
            question,
            answer: event.answer,
            sources: event.sources,
            answered: event.answered,
            mode: event.mode,
          });
          send({ ...event, ...saved });
        }
      } catch (error) {
        if (!request.signal.aborted) {
          const known = error instanceof LlmError || error instanceof StoreError;
          if (!known) console.error(error);
          send({ type: "error", message: known ? error.message : "The assistant could not answer just now." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
});

export const GET = () => json({ error: "Use POST." }, 405);
