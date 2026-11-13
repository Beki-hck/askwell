import { isUuid, json, readJson, route } from "@/lib/http";
import { getOwner } from "@/lib/session";
import { StoreError } from "@/lib/types";

export const PATCH = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const body = await readJson(request);
  if (!isUuid(id) || (body.status !== "open" && body.status !== "done")) {
    throw new StoreError("A follow-up id and a status are required.", 400);
  }
  const { store, business } = await getOwner();
  await store.setFollowUpStatus(business.id, id, body.status);
  return json({ ok: true });
});
