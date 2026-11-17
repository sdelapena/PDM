import sg from "@sendgrid/mail";

export function appUrl(): string {
  // VERCEL_URL is the per-deployment address, which Vercel puts behind its own login; email links must use the production domain.
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const u = process.env.APP_URL || (prod ? `https://${prod}` : "http://localhost:3000");
  return u.replace(/\/$/, "");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendMail(to: string[], subject: string, lines: string[], link?: { label: string; url: string }): Promise<void> {
  const recipients = [...new Set(to.filter((x) => x && !x.endsWith(".invalid")))];
  if (recipients.length === 0) return;
  const text = lines.join("\n") + (link ? `\n\n${link.label}: ${link.url}` : "");
  const html =
    `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#1c2033">` +
    `<div style="font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#5a6075">PDM · Product Development Manager</div>` +
    lines.map((l) => `<p style="margin:10px 0">${esc(l)}</p>`).join("") +
    (link ? `<p style="margin:18px 0"><a href="${link.url}" style="background:#2f5fd0;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${esc(link.label)}</a></p>` : "") +
    `</div>`;
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.log(`[email not configured] to=${recipients.join(",")} subject=${subject}\n${text}`);
    return;
  }
  sg.setApiKey(key);
  try {
    await sg.send({ to: recipients, from, subject, text, html, isMultiple: true });
  } catch (e) {
    console.error("SendGrid error", e);
  }
}
