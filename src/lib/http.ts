import { LlmError } from "./llm";
import { StoreError } from "./types";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/** Wraps a route handler so thrown errors become clean JSON responses. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof StoreError || error instanceof LlmError) {
        return json({ error: error.message }, error.status);
      }
      console.error(error);
      return json({ error: "Something went wrong on the server." }, 500);
    }
  };
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new StoreError("The request body is not valid JSON.", 400);
}

export function text(value: unknown, field: string, max: number, min = 1): string {
  if (typeof value !== "string") throw new StoreError(`${field} is required.`, 400);
  const clean = value.trim();
  if (clean.length < min) throw new StoreError(`${field} is required.`, 400);
  if (clean.length > max) throw new StoreError(`${field} is too long (max ${max} characters).`, 400);
  return clean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/* A small per-visitor rate limit. It lives in this server instance's memory,
   which is enough to stop a script hammering one instance; the per-business
   daily limit in the database is the hard ceiling. */
const hits = new Map<string, number[]>();

export function rateLimit(request: Request, bucket: string, max: number, windowMs: number): void {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    throw new StoreError("Too many requests. Wait a moment and try again.", 429);
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
}
