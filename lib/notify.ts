// Email notifications to a style's subscribers. Decisions for spec pending item 1:
// events = new discussion message, step rejected, CONF overdue (daily cron), Finalized, Cancelled; channel = email.
import { after } from "next/server";
import { db } from "./db";
import { appUrl, sendMail } from "./email";

export async function notifyStyle(styleId: string, actorId: string | null, subject: string, lines: string[]): Promise<void> {
  const style = await db.style.findUnique({
    where: { id: styleId },
    select: { pdNumber: true, t1CompanyId: true, subscriptions: { select: { user: { select: { id: true, email: true, type: true, companyId: true } } } } },
  });
  if (!style) return;
  const to = style.subscriptions
    .map((x) => x.user)
    // Never mail someone who can no longer see the style.
    .filter((u) => u.id !== actorId && (u.type === "ADMIN" || u.type === "JUSTIN" || (u.type === "T1" && u.companyId === style.t1CompanyId)))
    .map((u) => u.email);
  await sendMail(to, `[PDM] ${style.pdNumber} · ${subject}`, lines, { label: "Open PDM", url: appUrl() });
}

/** Sends after the response so a slow mail provider never delays the user. */
export function notifyLater(styleId: string, actorId: string | null, subject: string, lines: string[]): void {
  after(() => notifyStyle(styleId, actorId, subject, lines).catch((e) => console.error("notify failed", e)));
}
