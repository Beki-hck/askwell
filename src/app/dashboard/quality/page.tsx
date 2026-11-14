import { QualityRunner } from "@/components/dashboard/QualityRunner";
import { getViewer } from "@/lib/session";

export default async function Quality() {
  const { store, business, readOnly } = await getViewer();
  const [tests, runs] = await Promise.all([store.listTestCases(business.id), store.listEvalRuns(business.id)]);

  return (
    <main className="dash-page">
      <h1>Answer quality</h1>
      <p className="dash-hint">
        A list of questions with the facts a right answer must contain. Run it after you change a document to
        see whether the assistant got better or worse. Each answer is also checked against its sources: any
        number or sentence the passages do not back is flagged.
      </p>
      <QualityRunner tests={tests} runs={runs} readOnly={readOnly} />
    </main>
  );
}
