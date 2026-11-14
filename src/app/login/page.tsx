import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { Wordmark } from "@/components/SiteNav";
import { supabaseConfigured } from "@/lib/supabase/config";
import "../landing.css";
import "../dashboard/dashboard.css";

export const metadata: Metadata = { title: "Sign in" };

export default function Login() {
  return (
    <div className="login">
      <Wordmark />
      <main>
        <h1>Sign in to your owner area</h1>
        {supabaseConfigured ? (
          <LoginForm />
        ) : (
          <p className="dash-hint">
            Accounts are switched off on this copy of Askwell because no database is connected. The demo owner
            area is open to everyone.
          </p>
        )}
        <p className="login-alt">
          Just looking? <Link href="/dashboard">Open the demo owner area</Link>, no account needed.
        </p>
      </main>
    </div>
  );
}
