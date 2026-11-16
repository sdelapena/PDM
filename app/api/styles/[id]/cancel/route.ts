import { handler, HttpError, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { notifyLater } from "@/lib/notify";
import { assert, canManageStyles } from "@/lib/perm";
import { addHistory, loadStyle, serializeStyle } from "@/lib/styles";

export const POST = handler(async (_req, ctx: RouteContext<"/api/styles/[id]/cancel">) => {
  const me = await requireUser();
  assert(canManageStyles(me));
  const { id } = await ctx.params;
  const style = await loadStyle(me, id);
  if (style.cancelledAt) throw new HttpError(409, "This style is already cancelled.");
  await db.$transaction(async (tx) => {
    await tx.style.update({ where: { id }, data: { cancelledAt: new Date() } });
    await addHistory(tx, id, me.id, "Style cancelled", { field: "cancelled" });
  });
  notifyLater(id, me.id, "Cancelled", [`${me.name} cancelled style ${style.pdNumber} (${style.t1Company.name}).`]);
  return serializeStyle(await loadStyle(me, id));
});
