import type { Metadata } from "next";
import Link from "next/link";
import { DashNav } from "@/components/dashboard/DashNav";
import { SignOut } from "@/components/dashboard/SignOut";
import { Wordmark } from "@/components/SiteNav";
import { getViewer } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import "../landing.css";
import "./dashboard.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Owner area", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { business, readOnly, email, store } = await getViewer();
  const stats = await store.stats(business.id);

  return (
    <div className="dash">
      <aside className="dash-side">
        <Wordmark />
        <p className="dash-biz">
          <strong>{business.name}</strong>
          <span>{business.isDemo ? "Demo business" : email}</span>
        </p>
        <DashNav unanswered={stats.unanswered} followUps={stats.openFollowUps} />
        <div className="dash-side-foot">
          <Link href={business.isDemo ? "/demo" : `/embed/${business.slug}`}>
            {business.isDemo ? "View the demo site" : "Preview the chat box"}
          </Link>
          {email ? <SignOut /> : supabaseConfigured && <Link href="/login">Sign in</Link>}
        </div>
      </aside>

      <div className="dash-main">
        {business.isDemo && (
          <p className="dash-banner">
            {readOnly ? (
              <>
                You are looking at the demo business as its owner would. Everything is real and visible, and
                nothing can be changed.{" "}
                {supabaseConfigured && <Link href="/login">Sign in to set up your own assistant.</Link>}
              </>
            ) : (
              <>This is the demo business, running on this computer. Changes last until the server restarts.</>
            )}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
