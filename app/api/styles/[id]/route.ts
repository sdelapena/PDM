import { body, handler, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { assert, canEdit, isAdmin } from "@/lib/perm";
import { parseHeader } from "@/lib/style-input";
import { addHistory, loadStyle, serializeStyle } from "@/lib/styles";

type Ctx = RouteContext<"/api/styles/[id]">;

export const PATCH = handler(async (req, ctx: Ctx) => {
  const me = await requireUser();
  assert(canEdit(me));
  const { id } = await ctx.params;
  const style = await loadStyle(me, id);
  const h = await parseHeader(await body(req));

  await db.$transaction(async (tx) => {
    const log = (field: string, label: string, oldValue: string, newValue: string) =>
      addHistory(tx, id, me.id, `${label} → ${newValue || "—"}`, { field, oldValue, newValue });
    if (h.collection !== style.collection) await log("collection", "Collection", style.collection, h.collection);
    if (h.lineBuilderId !== style.lineBuilderId) {
      await log("lineBuilder", "Line Builder", style.lineBuilder?.name ?? "", h.lineBuilderName);
      await tx.notificationSubscription.upsert({
        where: { styleId_userId: { styleId: id, userId: h.lineBuilderId } },
        create: { styleId: id, userId: h.lineBuilderId },
        update: {},
      });
    }
    if (h.photo !== style.photo) await addHistory(tx, id, me.id, h.photo ? "Style photo updated" : "Style photo removed", { field: "photo" });

    await tx.style.update({
      where: { id },
      data: { collection: h.collection, lineBuilderId: h.lineBuilderId, photo: h.photo },
    });
  });
  return serializeStyle(await loadStyle(me, id));
});

// Logical delete: the row is kept (deleted_at) so the style can be recovered from the database.
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const me = await requireUser();
  assert(isAdmin(me));
  const { id } = await ctx.params;
  await loadStyle(me, id);
  await db.$transaction(async (tx) => {
    await tx.style.update({ where: { id }, data: { deletedAt: new Date() } });
    await addHistory(tx, id, me.id, "Style deleted", { field: "deleted" });
  });
  return { ok: true };
});
