import { body, handler, HttpError, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { assert, isAdmin } from "@/lib/perm";

export const PATCH = handler(async (req, ctx: RouteContext<"/api/companies/[id]">) => {
  const me = await requireUser();
  assert(isAdmin(me));
  const { id } = await ctx.params;
  const b = await body(req);
  const company = await db.company.findUnique({ where: { id } });
  if (!company || company.kind !== "T1" || typeof b.active !== "boolean") throw new HttpError(400, "Only factories can be switched on or off.");
  await db.company.update({ where: { id }, data: { active: b.active } });
  return { ok: true };
});
