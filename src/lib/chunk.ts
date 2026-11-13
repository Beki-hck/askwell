export interface Chunk {
  heading: string | null;
  position: number;
  content: string;
}

const TARGET = 650;
const MAX = 900;

/**
 * Cuts a document into passages the search can rank on their own.
 *
 * Headings start a new passage and are kept with it, so a passage about
 * "Pets" is still findable when its body never repeats the word. Long sections
 * are split on paragraph, then sentence, boundaries; a passage never ends
 * mid-sentence.
 */
export function chunkDocument(raw: string): Chunk[] {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  const sections: { heading: string | null; body: string[] }[] = [{ heading: null, body: [] }];
  for (const line of text.split("\n")) {
    const h = line.match(/^#{1,4}\s+(.+?)\s*#*$/);
    if (h) sections.push({ heading: h[1].trim(), body: [] });
    else sections[sections.length - 1].body.push(line);
  }

  const chunks: Chunk[] = [];
  const push = (heading: string | null, content: string) => {
    const clean = content.trim();
    if (clean) chunks.push({ heading, position: chunks.length, content: clean });
  };

  for (const section of sections) {
    const paragraphs = section.body
      .join("\n")
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\n(?![-*•]|\d+\.)/g, " ").trim())
      .filter(Boolean)
      .flatMap((p) => (p.length > MAX ? splitLong(p) : [p]));

    let current = "";
    for (const p of paragraphs) {
      if (current && current.length + p.length + 2 > TARGET) {
        push(section.heading, current);
        current = "";
      }
      current = current ? `${current}\n\n${p}` : p;
    }
    push(section.heading, current);
  }
  return chunks;
}

function splitLong(paragraph: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (const s of paragraph.split(/(?<=[.!?])\s+/)) {
    if (current && current.length + s.length + 1 > TARGET) {
      parts.push(current);
      current = "";
    }
    current = current ? `${current} ${s}` : s;
  }
  if (current) parts.push(current);
  // A single sentence longer than MAX: hard-wrap on spaces as a last resort.
  return parts.flatMap((p) => {
    if (p.length <= MAX) return [p];
    const out: string[] = [];
    let rest = p;
    while (rest.length > MAX) {
      const at = rest.lastIndexOf(" ", MAX);
      const cut = at > MAX / 2 ? at : MAX;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out;
  });
}
