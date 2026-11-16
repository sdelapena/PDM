import type { Prisma } from "@prisma/client";
import { body, dateToIso, handler, HttpError, isoToDateOrNull, requireUser } from "@/lib/api";
import { REJECTED, statusLabel, STEP_BY_NO, stepTitle } from "@/lib/catalog";
import { db } from "@/lib/db";
import { addDays, fmtDate } from "@/lib/logic";
import { notifyLater } from "@/lib/notify";
import { assert, canEdit } from "@/lib/perm";
import { isStoredPhotoUrl } from "@/lib/storage";
import { addHistory, computedStatus, loadStyle, serializeStyle, serverToday } from "@/lib/styles";

function money(v: unknown): Prisma.Decimal | null | number {
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n >= 1e8) throw new HttpError(400, "Enter a valid price.");
  return Math.round(n * 100) / 100;
}
const fmtMoney = (n: number | null) => (n === null ? "—" : `$${n.toFixed(2)}`);

export const PATCH = handler(async (req, ctx: RouteContext<"/api/subitems/[id]">) => {
  const me = await requireUser();
  // Covers statuses, dates, owner, prices and every other subitem field: T1 and T2 are read-only.
  assert(canEdit(me));
  const { id } = await ctx.params;
  const b = await body(req);

  const sub = await db.subitem.findUnique({ where: { id } });
  if (!sub) throw new HttpError(404, "Subitem not found.");
  const style = await loadStyle(me, sub.styleId);
  const step = STEP_BY_NO[sub.stepNo];
  const rounds = style.subitems.filter((x) => x.stepNo === sub.stepNo).length;
  if (sub.round !== rounds) throw new HttpError(409, "Earlier rounds are kept as a record and can't be edited.");
  const title = stepTitle(step, sub.round, rounds);
  const today = serverToday();
  const wasFinalized = computedStatus(style) === "FINALIZED";

  const data: Prisma.SubitemUncheckedUpdateInput = {};
  const logs: { text: string; field: string; oldValue?: string | null; newValue?: string | null; mergeKey?: string }[] = [];
  let openRound = false;
  let rejectedNow = false;

  if ("status" in b) {
    const status = String(b.status);
    if (step.auto) throw new HttpError(400, `${step.name} status is set automatically.`);
    if (!(step.statuses as string[]).includes(status)) throw new HttpError(400, "That status isn't valid for this step.");
    if (status !== sub.status) {
      data.status = status;
      let text = `${title}: status → ${statusLabel(status)}`;
      if (step.autoDates && status === "REQUESTED") {
        const conf = addDays(today, 28);
        data.reqDate = new Date(today + "T00:00:00Z");
        data.confDate = new Date(conf + "T00:00:00Z");
        text += ` (REQ ${fmtDate(today)}, CONF ${fmtDate(conf)})`;
      }
      if (step.rounds && (status === "REJECTED_MX" || status === "REJECTED_USA")) {
        openRound = true;
        text += ` — Round ${sub.round + 1} opened`;
      }
      rejectedNow = REJECTED.has(status);
      logs.push({ text, field: "status", oldValue: statusLabel(sub.status), newValue: statusLabel(status) });
    }
  }

  if ("ownerId" in b) {
    const ownerId = typeof b.ownerId === "string" && b.ownerId ? b.ownerId : null;
    if (ownerId !== sub.ownerId) {
      const owner = ownerId ? await db.user.findUnique({ where: { id: ownerId } }) : null;
      if (ownerId && !owner) throw new HttpError(400, "Choose a valid owner.");
      const prev = sub.ownerId ? await db.user.findUnique({ where: { id: sub.ownerId } }) : null;
      data.ownerId = ownerId;
      logs.push({ text: `${title}: owner → ${owner?.name ?? "—"}`, field: "owner", oldValue: prev?.name ?? null, newValue: owner?.name ?? null });
    }
  }

  const dateFields = [
    ["reqDate", "REQ", "RCR"],
    ["confDate", "CONF", "RCR"],
    ["realDate", "REAL", "RCR"],
    ["date", "date", "DATE"],
  ] as const;
  for (const [key, label, mode] of dateFields) {
    if (!(key in b)) continue;
    if (step.dates !== mode) throw new HttpError(400, `${step.name} doesn't have that date.`);
    const next = isoToDateOrNull(b[key]);
    const oldIso = dateToIso(sub[key]);
    const newIso = dateToIso(next);
    if (oldIso !== newIso) {
      data[key] = next;
      logs.push({ text: `${title}: ${label} → ${fmtDate(newIso) || "—"}`, field: key, oldValue: fmtDate(oldIso), newValue: fmtDate(newIso) });
    }
  }

  for (const key of ["price", "targetPrice"] as const) {
    if (!(key in b)) continue;
    if (!step.fields.includes(key)) throw new HttpError(400, `${step.name} doesn't have that field.`);
    const next = money(b[key]) as number | null;
    const old = sub[key] ? Number(sub[key]) : null;
    if (next !== old) {
      data[key] = next;
      const label = key === "price" ? "price" : "target price";
      logs.push({ text: `${title}: ${label} → ${fmtMoney(next)}`, field: key, oldValue: fmtMoney(old), newValue: fmtMoney(next), mergeKey: `${id}|${key}` });
    }
  }

  if ("pairs" in b) {
    if (!step.fields.includes("pairs")) throw new HttpError(400, `${step.name} doesn't have pairs.`);
    const next = b.pairs === null || b.pairs === "" ? null : Number(b.pairs);
    if (next !== null && (!Number.isInteger(next) || next < 0 || next > 1_000_000)) throw new HttpError(400, "Enter a valid number of pairs.");
    if (next !== sub.pairs) {
      data.pairs = next;
      logs.push({ text: `${title}: pairs → ${next ?? "—"}`, field: "pairs", oldValue: String(sub.pairs ?? ""), newValue: String(next ?? ""), mergeKey: `${id}|pairs` });
    }
  }

  if ("trackingNumber" in b) {
    if (!step.fields.includes("tracking")) throw new HttpError(400, `${step.name} doesn't have a tracking number.`);
    const next = String(b.trackingNumber ?? "").trim().slice(0, 60) || null;
    if (next !== sub.trackingNumber) {
      data.trackingNumber = next;
      logs.push({ text: `${title}: tracking# → ${next ?? "—"}`, field: "trackingNumber", oldValue: sub.trackingNumber, newValue: next, mergeKey: `${id}|tracking` });
    }
  }

  if ("description" in b) {
    if (!step.fields.includes("leather") && !step.fields.includes("material")) throw new HttpError(400, `${step.name} doesn't have a description.`);
    const raw = String(b.description ?? "").trim();
    if (raw.length > 40) throw new HttpError(400, "The description can have up to 40 characters.");
    const next = raw || null;
    if (next !== sub.description) {
      data.description = next;
      logs.push({ text: `${title}: description → ${next ?? "—"}`, field: "description", oldValue: sub.description, newValue: next, mergeKey: `${id}|description` });
    }
  }

  if ("photo" in b) {
    if (!step.fields.includes("photo")) throw new HttpError(400, `${step.name} doesn't have a photo.`);
    if (typeof b.photo !== "string" || !isStoredPhotoUrl(b.photo)) throw new HttpError(400, "Invalid photo.");
    if (b.photo !== sub.photo) {
      data.photo = b.photo;
      data.status = "UPLOADED";
      logs.push({ text: `${title}: photo uploaded`, field: "photo" });
    }
  }

  if (logs.length) {
    await db.$transaction(async (tx) => {
      await tx.subitem.update({ where: { id }, data });
      if (openRound) {
        // The new round starts empty; the owner is carried over as a default and can be changed.
        await tx.subitem.create({ data: { styleId: sub.styleId, stepNo: sub.stepNo, round: sub.round + 1, status: "NOT_STARTED", ownerId: sub.ownerId } });
      }
      for (const l of logs) await addHistory(tx, sub.styleId, me.id, l.text, l);
    });
  }

  const fresh = await loadStyle(me, sub.styleId);
  if (!fresh.cancelledAt) {
    if (rejectedNow) notifyLater(fresh.id, me.id, `${title} rejected`, [`${me.name} set ${title} to ${statusLabel(String(data.status))} on ${fresh.pdNumber} (${fresh.t1Company.name}).`]);
    if (!wasFinalized && computedStatus(fresh) === "FINALIZED") {
      notifyLater(fresh.id, me.id, "Finalized", [`Every step of ${fresh.pdNumber} (${fresh.t1Company.name}) is complete. The style is now Finalized.`]);
    }
  }
  return serializeStyle(fresh);
});
