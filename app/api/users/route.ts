import { body, handler, HttpError, requireUser, str } from "@/lib/api";
import { db } from "@/lib/db";
import { assert, isAdmin } from "@/lib/perm";
import { sendPasswordLink } from "@/lib/tokens";
import { parseEmail, parseType, resolveCompany } from "@/lib/user-input";

export const GET = handler(async () => {
  const me = await requireUser();
  assert(isAdmin(me));
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return { meId: me.id, users: users.map((u) => ({ id: u.id, name: u.name, email: u.email, type: u.type, companyId: u.companyId, isLineBuilder: u.isLineBuilder, hasPassword: !!u.passwordHash })) };
});

export const POST = handler(async (req) => {
  const me = await requireUser();
  assert(isAdmin(me));
  const b = await body(req);
  const name = str(b.name ?? "", 80);
  if (!name) throw new HttpError(400, "Enter a name.");
  const email = parseEmail(b.email);
  const type = parseType(b.type);
  const companyId = await resolveCompany(type, b.companyId);
  if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, "A user with that email already exists.");
  const user = await db.user.create({ data: { name, email, type, companyId } });
  // New users choose their own password from an emailed link.
  await sendPasswordLink(user, "invite");
  return { ok: true };
});
