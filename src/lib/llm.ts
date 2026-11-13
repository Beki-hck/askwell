export type ProviderId = "anthropic" | "openai" | "gemini" | "groq" | "ollama";

export interface LlmConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export const PROVIDERS: Record<
  ProviderId,
  { label: string; defaultModel: string; baseUrl: string; needsKey: boolean; keyHint: string }
> = {
  anthropic: {
    label: "Claude (Anthropic)",
    defaultModel: "claude-haiku-5-5",
    baseUrl: "https://api.anthropic.com/v1",
    needsKey: true,
    keyHint: "sk-ant-…",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
    keyHint: "sk-…",
  },
  gemini: {
    label: "Gemini (Google)",
    defaultModel: "gemini-2.0-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    needsKey: true,
    keyHint: "AIza…",
  },
  groq: {
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
    keyHint: "gsk_…",
  },
  ollama: {
    label: "Ollama (on this computer)",
    defaultModel: "llama3.2",
    baseUrl: "http://localhost:11434/v1",
    needsKey: false,
    keyHint: "No key needed",
  },
};

export function isProvider(value: unknown): value is ProviderId {
  return typeof value === "string" && value in PROVIDERS;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

/** The model the site owner configured on the server, if any. */
export function serverLlm(): LlmConfig | null {
  const provider = process.env.ASKWELL_LLM_PROVIDER;
  if (!isProvider(provider)) return null;
  const apiKey = process.env.ASKWELL_LLM_API_KEY ?? "";
  if (PROVIDERS[provider].needsKey && !apiKey) return null;
  return {
    provider,
    apiKey,
    model: process.env.ASKWELL_LLM_MODEL || PROVIDERS[provider].defaultModel,
    baseUrl: process.env.ASKWELL_LLM_BASE_URL || undefined,
  };
}

/**
 * A key a visitor pasted to try the live assistant. It arrives in request
 * headers, is used for that one request and is never written anywhere.
 */
export function llmFromHeaders(headers: Headers): LlmConfig | null {
  const provider = headers.get("x-askwell-provider");
  if (!isProvider(provider)) return null;
  const apiKey = headers.get("x-askwell-key")?.trim() ?? "";
  if (PROVIDERS[provider].needsKey && !apiKey) return null;
  // Ollama means "call a server on my own machine". That only makes sense when
  // this app runs on that machine too, so it is off on hosted deployments.
  if (provider === "ollama" && !localModelsAllowed()) return null;
  const model = headers.get("x-askwell-model")?.trim() || PROVIDERS[provider].defaultModel;
  if (model.length > 100 || apiKey.length > 400) return null;
  return { provider, apiKey, model };
}

export function localModelsAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ASKWELL_ALLOW_OLLAMA === "1";
}

/** Streams the model's reply as text pieces. */
export async function* streamChat(
  config: LlmConfig,
  system: string,
  turns: ChatTurn[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const base = (config.baseUrl || PROVIDERS[config.provider].baseUrl).replace(/\/$/, "");
  const anthropic = config.provider === "anthropic";

  const response = await fetch(anthropic ? `${base}/messages` : `${base}/chat/completions`, {
    method: "POST",
    signal,
    headers: anthropic
      ? {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        }
      : {
          "content-type": "application/json",
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
    body: JSON.stringify(
      anthropic
        ? { model: config.model, max_tokens: 700, system, messages: turns, stream: true }
        : {
            model: config.model,
            max_tokens: 700,
            temperature: 0.2,
            stream: true,
            messages: [{ role: "system", content: system }, ...turns],
          },
    ),
  }).catch((cause: unknown) => {
    if (signal?.aborted) throw cause;
    throw new LlmError(
      config.provider === "ollama"
        ? "Could not reach Ollama. Check that it is running on this computer."
        : `Could not reach ${PROVIDERS[config.provider].label}.`,
    );
  });

  if (!response.ok || !response.body) {
    throw new LlmError(await describeFailure(config, response), response.status);
  }

  for await (const data of sseData(response.body)) {
    if (data === "[DONE]") return;
    let event: unknown;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    const text = anthropic ? anthropicText(event) : openAiText(event);
    if (text) yield text;
  }
}

async function describeFailure(config: LlmConfig, response: Response): Promise<string> {
  const name = PROVIDERS[config.provider].label;
  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } | string };
    detail = typeof body.error === "string" ? body.error : (body.error?.message ?? "");
  } catch {
    // No readable body; the status code alone has to do.
  }
  if (response.status === 401 || response.status === 403)
    return `${name} rejected the key. Check that it is copied in full and still active.`;
  if (response.status === 404)
    return `${name} does not know the model "${config.model}". Check the model name.`;
  if (response.status === 429)
    return `${name} says this key is out of credit or over its rate limit.`;
  return `${name} returned an error (${response.status})${detail ? `: ${detail.slice(0, 200)}` : "."}`;
}

async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function anthropicText(event: unknown): string {
  const e = event as { type?: string; delta?: { type?: string; text?: string } };
  return e.type === "content_block_delta" && e.delta?.type === "text_delta"
    ? (e.delta.text ?? "")
    : "";
}

function openAiText(event: unknown): string {
  const e = event as { choices?: { delta?: { content?: string | null } }[] };
  return e.choices?.[0]?.delta?.content ?? "";
}
