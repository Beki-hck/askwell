import { AddDocument } from "@/components/dashboard/AddDocument";
import { DeleteButton } from "@/components/dashboard/DeleteButton";
import { timeAgo } from "@/lib/format";
import { getViewer } from "@/lib/session";

const KIND = { text: "Pasted text", pdf: "PDF", url: "Web page" } as const;

export default async function Documents() {
  const { store, business, readOnly } = await getViewer();
  const documents = await store.listDocuments(business.id);

  return (
    <main className="dash-page">
      <h1>Documents</h1>
      <p className="dash-hint">
        The assistant answers only from what is on this page. Each document is cut into short passages so the
        right paragraph can be found and quoted.
      </p>

      <AddDocument disabled={readOnly} />

      {documents.length === 0 ? (
        <p className="empty">No documents yet. Add your FAQ or help pages above, and the assistant can start answering.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Type</th>
              <th scope="col">Passages</th>
              <th scope="col">Added</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <th scope="row">
                  {doc.title}
                  {doc.sourceUrl && <small>{doc.sourceUrl}</small>}
                </th>
                <td>{KIND[doc.sourceType]}</td>
                <td>{doc.passageCount}</td>
                <td>{timeAgo(doc.createdAt)}</td>
                <td>
                  <DeleteButton
                    url={`/api/documents/${doc.id}`}
                    label={`Delete ${doc.title}`}
                    confirm={`Delete “${doc.title}”? The assistant will stop answering from it.`}
                    disabled={readOnly}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
