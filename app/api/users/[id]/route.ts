import type { Prisma } from "@prisma/client";
import { body, handler, HttpError, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { assert, isAdmin } from "@/lib/perm";
import { sendPasswordLink } from "@/lib/tokens";
import { parseEmail, parseType, resolveCompany } from "@/lib/user-input";

export const PATCH = handler(async (req, ctx: RouteContext<"/api/users/[id]">) => {
  const me = await requireUser();
  assert(isAdmin(me));
  const { id } = await ctx.params;
  const b = await body(req);
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "User not found.");

  const data: Prisma.UserUncheckedUpdateInput = {};
  if ("email" in b) {
    const email = parseEmail(b.email);
    if (email !== user.email) {
      if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, "A user with that email already exists.");
      data.email = email;
    }
  }
  let type = user.type;
  if ("type" in b || "companyId" in b) {
    type = "type" in b ? parseType(b.type) : user.type;
    if (id === me.id && type !== "ADMIN") throw new HttpError(400, "You can't remove your own Admin access.");
    data.type = type;
    data.companyId = await resolveCompany(type, "companyId" in b ? b.companyId : user.companyId);
    if (type === "T1" || type === "T2") data.isLineBuilder = false;
  }
  if ("isLineBuilder" in b) {
    if (typeof b.isLineBuilder !== "boolean") throw new HttpError(400, "Invalid value.");
    if (b.isLineBuilder && type !== "ADMIN" && type !== "JUSTIN") throw new HttpError(400, "Only Justin or Admin users can be Line Builders.");
    data.isLineBuilder = b.isLineBuilder;
  }
  const updated = await db.user.update({ where: { id }, data });
  // A user who never set a password gets a fresh invitation at the corrected address.
  if (data.email && !updated.passwordHash) await sendPasswordLink(updated, "invite");
  return { ok: true };
});
