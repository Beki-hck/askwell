/* The parts of document import that are plain text handling, kept apart so they can be tested. */

export function isPrivateAddress(address: string): boolean {
  const a = address.toLowerCase();
  if (a.includes(":")) {
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return a === "::" || a === "::1" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a);
  }
  const [x, y] = a.split(".").map(Number);
  return (
    x === 0 || x === 10 || x === 127 || x >= 224 ||
    (x === 100 && y >= 64 && y <= 127) ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && y === 168)
  );
}

/** Reduces a web page to its readable text, keeping headings as "# Heading" lines. */
export function htmlToText(html: string): string {
  const main = html.match(/<(main|article)\b[\s\S]*<\/\1>/i)?.[0] ?? html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html;
  const text = main
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|aside|template)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi, (_, inner: string) => `\n\n# ${inner.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|tr|ul|ol|table|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", pound: "£", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", hellip: "…" };
  return value
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => named[name.toLowerCase()] ?? whole);
}
