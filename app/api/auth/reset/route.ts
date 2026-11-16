import bcrypt from "bcryptjs";
import { body, handler, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

export const POST = handler(async (req) => {
  const b = await body(req);
  const token = typeof b.token === "string" ? b.token : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (password.length < 8 || password.length > 200) throw new HttpError(400, "The password must have at least 8 characters.");
  const row = await db.passwordToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new HttpError(400, "This link is invalid or has expired. Request a new one.");
  const passwordHash = await bcrypt.hash(password, 10);
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash, passwordChangedAt: new Date() } }),
    db.passwordToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true };
});
