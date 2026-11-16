import { body, handler, str } from "@/lib/api";
import { db } from "@/lib/db";
import { sendPasswordLink } from "@/lib/tokens";

export const POST = handler(async (req) => {
  const email = str((await body(req)).email).toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const recent = await db.passwordToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } } });
    if (recent < 3) await sendPasswordLink(user, "reset");
  }
  // Same answer whether or not the email exists.
  return { ok: true };
});
