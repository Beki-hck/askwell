import { json, readJson, route, text } from "@/lib/http";
import { textFromFile, textFromUrl } from "@/lib/ingest";
import { getOwner } from "@/lib/session";
import type { NewDocument } from "@/lib/store/types";
import { StoreError } from "@/lib/types";

export const maxDuration = 60;
const MAX_DOCUMENTS = 60;

/** Adds a document from an uploaded file, a web link or pasted text. */
export const POST = route(async (request: Request) => {
  const { store, business } = await getOwner();
  let doc: NewDocument;

  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new StoreError("Choose a file to upload.", 400);
    const parsed = await textFromFile(file);
    doc = { title: parsed.title, sourceType: parsed.kind, sourceUrl: null, content: parsed.content };
  } else {
    const body = await readJson(request);
    if (typeof body.url === "string" && body.url.trim()) {
      const page = await textFromUrl(body.url.trim());
      doc = { title: page.title.slice(0, 160), sourceType: "url", sourceUrl: page.url, content: page.content };
    } else {
      doc = {
        title: text(body.title, "Title", 160),
        sourceType: "text",
        sourceUrl: null,
        content: text(body.content, "Content", 300_000, 20),
      };
    }
  }

  if ((await store.listDocuments(business.id)).length >= MAX_DOCUMENTS) {
    throw new StoreError(`This plan holds ${MAX_DOCUMENTS} documents. Delete one to add another.`, 409);
  }
  return json({ document: await store.addDocument(business.id, doc) }, 201);
});
