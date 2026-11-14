import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { isUuid } from "@/lib/http";
import { getViewer } from "@/lib/session";

export default async function Conversations({ searchParams }: { searchParams: Promise<{ c?: string; only?: string }> }) {
  const { c, only } = await searchParams;
  const { store, business } = await getViewer();
  const all = await store.listConversations(business.id);
  const list = only === "unanswered" ? all.filter((x) => x.unanswered > 0) : all;
  const selectedId = isUuid(c) && all.some((x) => x.id === c) ? c : list[0]?.id;
  const messages = selectedId ? await store.getMessages(business.id, selectedId) : [];
  const query = (id: string) => `/dashboard/conversations?c=${id}${only ? `&only=${only}` : ""}`;

  return (
    <main className="dash-page">
      <h1>Conversations</h1>
      <p className="filter">
        <Link href="/dashboard/conversations" aria-current={only ? undefined : "true"}>
          All ({all.length})
        </Link>
        <Link href="/dashboard/conversations?only=unanswered" aria-current={only === "unanswered" ? "true" : undefined}>
          With an unanswered question ({all.filter((x) => x.unanswered > 0).length})
        </Link>
      </p>

      {list.length === 0 ? (
        <p className="empty">No conversations here yet.</p>
      ) : (
        <div className="convo">
          <ul className="convo-list" aria-label="Conversations">
            {list.map((item) => (
              <li key={item.id}>
                <Link href={query(item.id)} aria-current={item.id === selectedId ? "true" : undefined}>
                  <span>{item.preview}</span>
                  <small>
                    {timeAgo(item.lastMessageAt)}, {item.messageCount / 2} {item.messageCount === 2 ? "question" : "questions"}
                    {item.unanswered > 0 && <b> , {item.unanswered} unanswered</b>}
                  </small>
                </Link>
              </li>
            ))}
          </ul>

          <section className="transcript" aria-label="Transcript">
            {messages.map((m) => (
              <div key={m.id} className={`line line-${m.role}`}>
                <p className="line-who">
                  {m.role === "visitor" ? "Visitor" : business.assistantName}
                  {m.answered === false && <span className="tag tag-warn">Declined</span>}
                  {m.mode === "search" && m.answered && <span className="tag">Quoted from documents</span>}
                  {m.mode === "model" && m.answered && <span className="tag">Written by the model</span>}
                  {m.feedback === 1 && <span className="tag tag-good">Marked helpful</span>}
                  {m.feedback === -1 && <span className="tag tag-warn">Marked not helpful</span>}
                </p>
                <p className="line-text">{m.content.replace(/\s*\[\d+\]/g, "")}</p>
                {m.sources.length > 0 && (
                  <p className="line-src">
                    Source: {m.sources.map((s) => `${s.documentTitle}${s.heading ? ` / ${s.heading}` : ""}`).join("; ")}
                  </p>
                )}
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}
