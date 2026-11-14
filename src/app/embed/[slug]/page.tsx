import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Widget } from "@/components/chat/Widget";
import { getChatProps } from "@/lib/public";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chat", robots: { index: false } };

/** The page the embed script loads in an iframe on a customer's website. */
export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const props = await getChatProps((await params).slug);
  if (!props) notFound();
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      <Widget {...props} embedded />
    </>
  );
}
