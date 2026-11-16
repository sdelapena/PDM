import { handler, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { loadStyle } from "@/lib/styles";

export const GET = handler(async (_req, ctx: RouteContext<"/api/styles/[id]/history">) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  await loadStyle(me, id);
  const rows = await db.historyEntry.findMany({ where: { styleId: id }, include: { user: { select: { name: true } } }, orderBy: [{ timestamp: "desc" }, { id: "desc" }] });
  return { entries: rows.map((h) => ({ id: h.id, user: h.user?.name ?? "System", timestamp: h.timestamp.toISOString(), description: h.description })) };
});
