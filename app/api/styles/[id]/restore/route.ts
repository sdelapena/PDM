import { handler, HttpError, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { assert, isAdmin } from "@/lib/perm";
import { addHistory, loadStyle, serializeStyle } from "@/lib/styles";

export const POST = handler(async (_req, ctx: RouteContext<"/api/styles/[id]/restore">) => {
  const me = await requireUser();
  assert(isAdmin(me));
  const { id } = await ctx.params;
  const style = await loadStyle(me, id);
  if (!style.cancelledAt) throw new HttpError(409, "This style is not cancelled.");
  await db.$transaction(async (tx) => {
    await tx.style.update({ where: { id }, data: { cancelledAt: null } });
    await addHistory(tx, id, me.id, "Style restored (Cancelled removed)", { field: "cancelled" });
  });
  return serializeStyle(await loadStyle(me, id));
});
