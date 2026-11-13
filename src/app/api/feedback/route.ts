import { isUuid, json, rateLimit, readJson, route } from "@/lib/http";
import { getStore } from "@/lib/store";
import { StoreError } from "@/lib/types";

export const POST = route(async (request: Request) => {
  rateLimit(request, "feedback", 40, 60_000);
  const body = await readJson(request);
  if (!isUuid(body.messageId) || (body.value !== 1 && body.value !== -1)) {
    throw new StoreError("A message id and a value of 1 or -1 are required.", 400);
  }
  await (await getStore()).setFeedback(body.messageId, body.value);
  return json({ ok: true });
});
