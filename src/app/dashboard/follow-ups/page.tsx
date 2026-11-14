import Link from "next/link";
import { FollowUpToggle } from "@/components/dashboard/FollowUpToggle";
import { timeAgo } from "@/lib/format";
import { getViewer } from "@/lib/session";

export default async function FollowUps() {
  const { store, business, readOnly } = await getViewer();
  const items = await store.listFollowUps(business.id);

  return (
    <main className="dash-page">
      <h1>Follow-ups</h1>
      <p className="dash-hint">
        Visitors who asked something the assistant could not answer, and left an email so a person can reply.
        {business.isDemo && " In the demo, addresses are masked before they are stored."}
      </p>

      {items.length === 0 ? (
        <p className="empty">No one is waiting for a reply.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Reply to</th>
              <th scope="col">Asked</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id} data-done={f.status === "done" || undefined}>
                <th scope="row">
                  {f.conversationId ? (
                    <Link href={`/dashboard/conversations?c=${f.conversationId}`}>{f.question}</Link>
                  ) : (
                    f.question
                  )}
                </th>
                <td>{f.email}</td>
                <td>{timeAgo(f.createdAt)}</td>
                <td>
                  <FollowUpToggle id={f.id} status={f.status} disabled={readOnly} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
