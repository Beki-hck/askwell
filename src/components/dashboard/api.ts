"use client";

import { errorMessage } from "@/lib/client/stream";

/** Calls one of the app's own JSON routes. Returns an error message, or null on success. */
export async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: body instanceof FormData || body === undefined ? undefined : { "content-type": "application/json" },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    return response.ok ? null : await errorMessage(response);
  } catch {
    return "Could not reach the server. Check your connection.";
  }
}
