import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentBody } from "@/components/DocumentBody";
import { isUuid } from "@/lib/http";
import { DEMO_SLUG } from "@/lib/session";
import { getStore } from "@/lib/store";
import "../../larkspur.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Help centre | Larkspur Night Line (Askwell demo)" } };

export default async function HelpArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getStore();
  const business = await store.getBusiness(DEMO_SLUG);
  const doc = business && isUuid(id) ? await store.getDocument(business.id, id) : null;
  if (!doc) notFound();

  return (
    <div className="lk lk-article">
      <header className="lk-top">
        <Link href="/demo" className="lk-logo">
          Larkspur Night Line
        </Link>
        <nav aria-label="Larkspur">
          <Link href="/demo#help">All help pages</Link>
        </nav>
      </header>
      <main>
        <DocumentBody content={doc.content} />
      </main>
    </div>
  );
}
