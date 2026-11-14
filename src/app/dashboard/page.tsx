import Link from "next/link";
import { LastRun } from "@/components/dashboard/LastRun";
import { percent, timeAgo } from "@/lib/format";
import { getViewer } from "@/lib/session";

export default async function Overview() {
  const { store, business } = await getViewer();
  const [stats, unanswered, conversations, runs] = await Promise.all([
    store.stats(business.id),
    store.listUnanswered(business.id),
    store.listConversations(business.id),
    store.listEvalRuns(business.id),
  ]);
  const rated = stats.helpful + stats.notHelpful;
  const lastRun = runs[0];

  return (
    <main className="dash-page">
      <h1>Overview</h1>

      <dl className="figures">
        <div>
          <dt>Questions asked</dt>
          <dd>{stats.questions}</dd>
          <dd className="figures-note">{stats.questionsToday} today, limit {business.dailyLimit} a day</dd>
        </div>
        <div>
          <dt>Answered from documents</dt>
          <dd>{percent(stats.answered, stats.questions)}</dd>
          <dd className="figures-note">{stats.unanswered} declined</dd>
        </div>
        <div>
          <dt>Marked helpful</dt>
          <dd>{rated ? percent(stats.helpful, rated) : "No ratings"}</dd>
          <dd className="figures-note">{rated ? `${stats.helpful} of ${rated} ratings` : "Visitors have not rated an answer yet"}</dd>
        </div>
        <div>
          <dt>Knowledge base</dt>
          <dd>{stats.documents}</dd>
          <dd className="figures-note">documents, {stats.passages} passages</dd>
        </div>
      </dl>

      <div className="dash-cols">
        <section aria-labelledby="gaps-title">
          <h2 id="gaps-title">Questions it could not answer</h2>
          <p className="dash-hint">
            Each of these is a gap in your documents. Add a page that covers it and the assistant will answer
            next time.
          </p>
          {unanswered.length ? (
            <ul className="rows">
              {unanswered.slice(0, 8).map((u) => (
                <li key={u.messageId}>
                  <Link href={`/dashboard/conversations?c=${u.conversationId}`}>{u.question}</Link>
                  <time dateTime={u.createdAt}>{timeAgo(u.createdAt)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Nothing yet. Every question so far was answered from your documents.</p>
          )}
        </section>

        <section aria-labelledby="recent-title">
          <h2 id="recent-title">Latest conversations</h2>
          {conversations.length ? (
            <ul className="rows">
              {conversations.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/dashboard/conversations?c=${c.id}`}>{c.preview}</Link>
                  <time dateTime={c.lastMessageAt}>{timeAgo(c.lastMessageAt)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No one has asked a question yet. Add the chat box to your site from Settings.</p>
          )}

          <h2 className="dash-gap">Answer quality</h2>
          <LastRun
            businessId={business.id}
            saved={
              lastRun
                ? { passed: lastRun.correct + lastRun.declinedCorrectly, total: lastRun.total, createdAt: lastRun.createdAt }
                : null
            }
          />
        </section>
      </div>
    </main>
  );
}
