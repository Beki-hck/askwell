import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { StoreError } from "./types";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CHARS = 300_000;

export async function textFromFile(file: File): Promise<{ title: string; content: string; kind: "pdf" | "text" }> {
  if (file.size > MAX_BYTES) throw new StoreError("That file is larger than 4 MB.", 413);
  const title = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Untitled";
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  if (isPdf) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    let content: string;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const pages = (await extractText(pdf, { mergePages: false })).text;
      content = pages.join("\n\n");
    } catch {
      throw new StoreError("That PDF could not be read. It may be damaged or password-protected.", 422);
    }
    if (content.replace(/\s/g, "").length < 40) {
      throw new StoreError("That PDF has no selectable text. Scanned pages need OCR first.", 422);
    }
    return { title, content: clip(content), kind: "pdf" };
  }

  if (!/\.(txt|md|markdown)$/i.test(file.name) && !file.type.startsWith("text/")) {
    throw new StoreError("Upload a PDF, .txt or .md file.", 415);
  }
  return { title, content: clip(await file.text()), kind: "text" };
}

export async function textFromUrl(raw: string): Promise<{ title: string; content: string; url: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new StoreError("That is not a valid web address.", 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new StoreError("Only http and https links can be imported.", 400);
  }
  await assertPublicHost(url.hostname);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "error", // a redirect could point back inside the network
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "AskwellBot/1.0 (document import)", accept: "text/html,text/plain" },
    });
  } catch {
    throw new StoreError("That page could not be loaded. Check the link, or paste the text instead.", 422);
  }
  if (!response.ok) throw new StoreError(`That page answered with an error (${response.status}).`, 422);
  const type = response.headers.get("content-type") ?? "";
  if (!/text\/(html|plain)/.test(type)) throw new StoreError("That link is not a web page or text file.", 415);

  const body = (await response.text()).slice(0, MAX_BYTES);
  const isHtml = type.includes("html");
  const title = (isHtml && body.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1].trim()) || url.hostname + url.pathname;
  const content = isHtml ? htmlToText(body) : body;
  if (content.replace(/\s/g, "").length < 40) throw new StoreError("No readable text was found on that page.", 422);
  return { title: decodeEntities(title), content: clip(content), url: url.toString() };
}

/** Refuses addresses inside private networks, so the importer cannot be used to probe them. */
async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true }).then(
        (list) => list.map((a) => a.address),
        () => {
          throw new StoreError("That web address could not be found.", 422);
        },
      );
  for (const address of addresses) {
    if (isPrivateAddress(address)) throw new StoreError("That address is not on the public internet.", 400);
  }
}

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

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", pound: "£", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", hellip: "…" };
  return value
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => named[name.toLowerCase()] ?? whole);
}

const clip = (content: string) => content.replace(/\u0000/g, "").slice(0, MAX_CHARS).trim();
