import { body, dateToIso, handler, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/logic";
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
  const t2Names = new Map((await db.company.findMany({ where: { kind: "T2" }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const oldT2 = [1, 2].map((slot) => style.t2s.find((x) => x.slot === slot)?.companyId ?? null);

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
    for (const i of [0, 1]) {
      if (h.t2[i] !== oldT2[i]) await log(`t2_${i + 1}`, `T2 #${i + 1}`, t2Names.get(oldT2[i] ?? "") ?? "", t2Names.get(h.t2[i] ?? "") ?? "");
    }
    const oldDate = dateToIso(style.firstPoDate)!;
    const newDate = dateToIso(h.firstPoDate)!;
    if (oldDate !== newDate) await log("firstPoDate", "First PO Date", fmtDate(oldDate), fmtDate(newDate));
    if (h.photo !== style.photo) await addHistory(tx, id, me.id, h.photo ? "Style photo updated" : "Style photo removed", { field: "photo" });

    await tx.style.update({
      where: { id },
      data: { collection: h.collection, lineBuilderId: h.lineBuilderId, firstPoDate: h.firstPoDate, photo: h.photo },
    });
    await tx.styleT2.deleteMany({ where: { styleId: id } });
    const slots = h.t2.map((companyId, i) => ({ styleId: id, slot: i + 1, companyId })).filter((x): x is { styleId: string; slot: number; companyId: string } => !!x.companyId);
    if (slots.length) await tx.styleT2.createMany({ data: slots });
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
