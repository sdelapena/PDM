import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { appUrl, sendMail } from "./email";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Emails a single-use link to set a password. Used for password recovery and for inviting new users. */
export async function sendPasswordLink(user: { id: string; email: string; name: string }, kind: "reset" | "invite"): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const hours = kind === "invite" ? 24 * 7 : 1;
  await db.passwordToken.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + hours * 3600 * 1000) },
  });
  const url = `${appUrl()}/reset-password?token=${token}`;
  if (kind === "invite") {
    await sendMail([user.email], "[PDM] Your account", [`Hi ${user.name},`, "An account was created for you in PDM · Product Development Manager.", "Use the button below to choose your password. The link is valid for 7 days."], { label: "Choose password", url });
  } else {
    await sendMail([user.email], "[PDM] Reset your password", [`Hi ${user.name},`, "We received a request to reset your PDM password. The link is valid for 1 hour.", "If you didn't ask for this, you can ignore this email."], { label: "Reset password", url });
  }
}
