import { chunkDocument } from "@/lib/chunk";

/**
 * Renders a stored document as readable sections. `highlight` marks the
 * section an answer was taken from.
 */
export function DocumentBody({
  content,
  highlight,
  level = 1,
}: {
  content: string;
  highlight?: string | null;
  /** Heading level of the title, so the document nests correctly in the page around it. */
  level?: 1 | 3;
}) {
  const Title = level === 1 ? "h1" : "h3";
  const Heading = level === 1 ? "h2" : "h4";
  const title = content.match(/^#\s+(.+)$/m)?.[1];
  const sections = new Map<string, string[]>();
  for (const chunk of chunkDocument(content)) {
    const key = chunk.heading ?? "";
    sections.set(key, [...(sections.get(key) ?? []), chunk.content]);
  }

  return (
    <article className="doc">
      {title && <Title className="doc-title">{title}</Title>}
      {[...sections].map(([heading, parts]) => {
        if (heading === title && !parts.join("").trim()) return null;
        const marked = highlight != null && heading === highlight;
        return (
          <section key={heading} data-marked={marked || undefined}>
            {heading && heading !== title && <Heading className="doc-heading">{heading}</Heading>}
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
