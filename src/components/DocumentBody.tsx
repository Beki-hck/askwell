import { chunkDocument } from "@/lib/chunk";

/**
 * Renders a stored document as readable sections. `highlight` marks the
 * section an answer was taken from.
 */
export function DocumentBody({ content, highlight }: { content: string; highlight?: string | null }) {
  const title = content.match(/^#\s+(.+)$/m)?.[1];
  const sections = new Map<string, string[]>();
  for (const chunk of chunkDocument(content)) {
    const key = chunk.heading ?? "";
    sections.set(key, [...(sections.get(key) ?? []), chunk.content]);
  }

  return (
    <article className="doc">
      {title && <h1>{title}</h1>}
      {[...sections].map(([heading, parts]) => {
        if (heading === title && !parts.join("").trim()) return null;
        const marked = highlight != null && heading === highlight;
        return (
          <section key={heading} data-marked={marked || undefined}>
            {heading && heading !== title && <h2>{heading}</h2>}
            {parts
              .join("\n\n")
              .split(/\n{2,}/)
              .map((block, i) => {
                const lines = block.split("\n");
                if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
                  return (
                    <ul key={i}>
                      {lines.map((l, j) => (
                        <li key={j}>
                          <span>{l.replace(/^\s*[-*•]\s+/, "")}</span>
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={i}>
                    <span>{block}</span>
                  </p>
                );
              })}
          </section>
        );
      })}
    </article>
  );
}
