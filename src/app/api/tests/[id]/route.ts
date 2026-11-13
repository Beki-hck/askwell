import { isUuid, json, route } from "@/lib/http";
import { getOwner } from "@/lib/session";
import { StoreError } from "@/lib/types";

export const DELETE = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  if (!isUuid(id)) throw new StoreError("Test not found.", 404);
  const { store, business } = await getOwner();
  await store.deleteTestCase(business.id, id);
  return json({ ok: true });
});
