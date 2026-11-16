import bcrypt from "bcryptjs";
import { body, handler, HttpError, str } from "@/lib/api";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

// Compared against when the user doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY = bcrypt.hashSync("no-such-user", 10);

export const POST = handler(async (req) => {
  const b = await body(req);
  const email = str(b.email).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY);
  if (!user || !user.passwordHash || !ok) throw new HttpError(401, "Incorrect email or password.");
  await createSession(user.id);
  return { ok: true };
});
