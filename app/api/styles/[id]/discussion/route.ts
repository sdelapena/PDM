import { body, handler, HttpError, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { notifyLater } from "@/lib/notify";
import { loadStyle } from "@/lib/styles";

type Ctx = RouteContext<"/api/styles/[id]/discussion">;

async function list(styleId: string) {
  const rows = await db.discussionMessage.findMany({ where: { styleId }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } });
  return rows.map((m) => ({ id: m.id, author: m.author.name, text: m.text, createdAt: m.createdAt.toISOString() }));
}

// loadStyle limits this to Admin, Justin and the T1 users of the style's factory.
export const GET = handler(async (_req, ctx: Ctx) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  await loadStyle(me, id);
  return { messages: await list(id) };
});

export const POST = handler(async (req, ctx: Ctx) => {
  const me = await requireUser();
  const { id } = await ctx.params;
  const style = await loadStyle(me, id);
  const raw = (await body(req)).text;
  const text = typeof raw === "string" ? raw.trim().slice(0, 4000) : "";
  if (!text) throw new HttpError(400, "Write a message first.");
  await db.discussionMessage.create({ data: { styleId: id, authorId: me.id, text } });
  if (!style.cancelledAt) notifyLater(id, me.id, "New message", [`${me.name} wrote in the discussion of ${style.pdNumber}:`, text]);
  return { messages: await list(id) };
});
