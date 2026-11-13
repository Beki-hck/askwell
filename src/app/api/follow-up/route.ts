import { isUuid, json, rateLimit, readJson, route, text } from "@/lib/http";
import { getStore } from "@/lib/store";
import { StoreError } from "@/lib/types";

export const POST = route(async (request: Request) => {
  rateLimit(request, "follow-up", 5, 60_000);
  const body = await readJson(request);
  const email = text(body.email, "Email", 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new StoreError("Enter an email address like name@example.com.", 400);
  }
  const store = await getStore();
  const business = await store.getBusiness(text(body.slug, "Business", 40));
  if (!business) throw new StoreError("This assistant does not exist.", 404);
  await store.addFollowUp(business, {
    conversationId: isUuid(body.conversationId) ? body.conversationId : null,
    email,
    question: text(body.question, "Question", 1000),
  });
  return json({ ok: true });
});
