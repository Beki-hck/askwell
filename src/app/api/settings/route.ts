import { json, readJson, route, text } from "@/lib/http";
import { getOwner } from "@/lib/session";
import { StoreError, type Tone } from "@/lib/types";

const TONES: Tone[] = ["warm", "plain", "formal"];

export const PATCH = route(async (request: Request) => {
  const { store, business } = await getOwner();
  const body = await readJson(request);
  if (!TONES.includes(body.tone as Tone)) throw new StoreError("Choose a tone.", 400);
  const dailyLimit = Number(body.dailyLimit);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 5000) {
    throw new StoreError("The daily limit must be a whole number from 1 to 5000.", 400);
  }
  const suggestions = Array.isArray(body.suggestions)
    ? body.suggestions
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 4)
    : business.suggestions;

  const updated = await store.updateBusiness(business.id, {
    name: text(body.name, "Business name", 80),
    assistantName: text(body.assistantName, "Assistant name", 40),
    greeting: text(body.greeting, "Greeting", 400),
    tone: body.tone as Tone,
    dailyLimit,
    suggestions,
  });
  return json({ business: updated });
});
