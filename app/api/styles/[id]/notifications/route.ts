import { body, handler, HttpError, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { assert, canEdit, canViewStyle } from "@/lib/perm";
import { loadStyle } from "@/lib/styles";

type Ctx = RouteContext<"/api/styles/[id]/notifications">;

async function list(styleId: string) {
  const rows = await db.notificationSubscription.findMany({ where: { styleId }, include: { user: { select: { id: true, name: true, type: true } } }, orderBy: { user: { name: "asc" } } });
  return { subscribers: rows.map((r) => r.user) };
}

async function gate(ctx: Ctx) {
  const me = await requireUser();
  assert(canEdit(me));
  const { id } = await ctx.params;
  return { id, style: await loadStyle(me, id) };
}

export const GET = handler(async (_req, ctx: Ctx) => list((await gate(ctx)).id));

export const POST = handler(async (req, ctx: Ctx) => {
  const { id, style } = await gate(ctx);
  const userId = (await body(req)).userId;
  const user = typeof userId === "string" ? await db.user.findUnique({ where: { id: userId } }) : null;
  // T2 users and other factories can't see the discussion, so they can't be notified about it either.
  if (!user || !canViewStyle(user, style)) throw new HttpError(400, "That user can't receive notifications for this style.");
  await db.notificationSubscription.upsert({ where: { styleId_userId: { styleId: id, userId: user.id } }, create: { styleId: id, userId: user.id }, update: {} });
  return list(id);
});

export const DELETE = handler(async (req, ctx: Ctx) => {
  const { id } = await gate(ctx);
  const userId = req.nextUrl.searchParams.get("userId") ?? "";
  await db.notificationSubscription.deleteMany({ where: { styleId: id, userId } });
  return list(id);
});
