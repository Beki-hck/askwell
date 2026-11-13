const STOP = new Set(
  `a an and are as at be but by can could do does for from had has have how i if in into is it its
  me my of on or our so than that the their them then there these they this to up us was we were
  what when where which who why will with would you your am did about any some get got just also
  not no yes please tell want need know like many much take go got now there's still even long should shall may might must he she him her his hers thing`.split(/\s+/),
);

/** Light stemmer: enough to match "refunds" with "refund" and "boarding" with "board". */
export function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("es") && /(s|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && /(.)\1$/.test(w) && !/(ss|ee|oo)$/.test(w)) w = w.slice(0, -1);
  // "close" and "closing", "arrive" and "arrived" should meet at the same stem.
  if (w.length > 3 && w.endsWith("e") && !w.endsWith("ee")) w = w.slice(0, -1);
  return w;
}

export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+(?:[.:'][a-z0-9]+)*/g) ?? [];
}

/** Lowercased, stemmed content words. Stop words are dropped. */
export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const raw of words(text)) {
    const w = raw.replace(/'(s|re|ve|ll|d|m)$/, "");
    if (STOP.has(w) || STOP.has(raw)) continue;
    out.push(stem(w));
  }
  return out;
}

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function excerpt(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)) + "…";
}

/** Numbers, prices, times and percentages. Wrong ones are the costliest mistakes in support. */
export function figures(text: string): string[] {
  const found = text.match(/\d+(?:[.,:]\d+)*%?/g) ?? [];
  return found.map((f) => f.replace(/,/g, "").replace(/[.:]$/, ""));
}
