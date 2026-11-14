import { headers } from "next/headers";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { KeyStatus } from "@/components/dashboard/KeyStatus";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { PROVIDERS, localModelsAllowed, serverLlm } from "@/lib/llm";
import { getViewer } from "@/lib/session";

export default async function Settings() {
  const { business, readOnly } = await getViewer();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const snippet = `<script src="${origin}/widget.js" data-business="${business.slug}" async></script>`;
  const llm = serverLlm();

  return (
    <main className="dash-page">
      <h1>Settings</h1>

      <section className="panel" aria-labelledby="assistant-title">
        <h2 id="assistant-title">Your assistant</h2>
        <SettingsForm business={business} disabled={readOnly} />
      </section>

      <section className="panel" aria-labelledby="embed-title">
        <h2 id="embed-title">Add the chat box to your website</h2>
        <p className="dash-hint">
          Paste this one line just before <code>&lt;/body&gt;</code> on every page where the chat box should
          appear. Nothing else to install.
        </p>
        <pre className="snippet" tabIndex={0}>
          <code>{snippet}</code>
        </pre>
        <CopyButton text={snippet} />
      </section>

      <section className="panel" aria-labelledby="model-title">
        <h2 id="model-title">AI model</h2>
        {llm ? (
          <p>
            This site is set up to write answers with <strong>{PROVIDERS[llm.provider].label}</strong>, model{" "}
            <code>{llm.model}</code>. The key is stored in the server&rsquo;s environment settings and is never
            sent to the browser.
          </p>
        ) : (
          <p>
            No model is configured on the server, so visitors get search-only answers: the matching passage,
            quoted word for word. To have a model write the answers for every visitor, set{" "}
            <code>ASKWELL_LLM_PROVIDER</code> and <code>ASKWELL_LLM_API_KEY</code> in the hosting settings.
          </p>
        )}
        <KeyStatus allowLocal={localModelsAllowed()} />
      </section>
    </main>
  );
}
