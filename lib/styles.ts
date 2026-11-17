import { Prisma, type User } from "@prisma/client";
import { db } from "./db";
import { dateToIso, HttpError } from "./api";
import { canViewStyle } from "./perm";
import { initialStatus, STEPS, type Step } from "./catalog";
import { styleStatus, todayISO, type SubLike } from "./logic";

export type Tx = Prisma.TransactionClient;

export const STYLE_INCLUDE = {
  t1Company: { select: { id: true, name: true } },
  lineBuilder: { select: { id: true, name: true } },
  subitems: { include: { owner: { select: { name: true } } }, orderBy: [{ stepNo: "asc" }, { round: "asc" }] },
  _count: { select: { messages: true, subscriptions: true } },
} satisfies Prisma.StyleInclude;

export type FullStyle = Prisma.StyleGetPayload<{ include: typeof STYLE_INCLUDE }>;

export function serverToday(): string {
  return todayISO(process.env.APP_TIMEZONE || "America/Mexico_City");
}

export function serializeStyle(s: FullStyle) {
  return {
    id: s.id,
    pdNumber: s.pdNumber,
    collection: s.collection,
    lineBuilderId: s.lineBuilderId,
    lineBuilderName: s.lineBuilder?.name ?? null,
    factoryId: s.t1CompanyId,
    factory: s.t1Company.name,
    photo: s.photo,
    cancelled: !!s.cancelledAt,
    messages: s._count.messages,
    subscribers: s._count.subscriptions,
    subitems: s.subitems.map((x) => ({
      id: x.id,
      stepNo: x.stepNo,
      round: x.round,
      status: x.status,
      ownerId: x.ownerId,
      ownerName: x.owner?.name ?? null,
      reqDate: dateToIso(x.reqDate),
      confDate: dateToIso(x.confDate),
      realDate: dateToIso(x.realDate),
      date: dateToIso(x.date),
      price: x.price ? x.price.toFixed(2) : null,
      targetPrice: x.targetPrice ? x.targetPrice.toFixed(2) : null,
      pairs: x.pairs,
      trackingNumber: x.trackingNumber,
      description: x.description,
      photo: x.photo,
    })),
  };
}
export type StyleDTO = ReturnType<typeof serializeStyle>;

export function subLikes(s: FullStyle): SubLike[] {
  return s.subitems.map((x) => ({
    stepNo: x.stepNo,
    round: x.round,
    status: x.status,
    confDate: dateToIso(x.confDate),
    targetPrice: x.targetPrice ? x.targetPrice.toFixed(2) : null,
  }));
}

export function computedStatus(s: FullStyle) {
  return styleStatus(subLikes(s), !!s.cancelledAt, serverToday());
}

/** Loads a style the user is allowed to see; anything else is a 404 so external users can't probe ids. */
export async function loadStyle(user: User, id: string, client: Tx | typeof db = db): Promise<FullStyle> {
  const s = await client.style.findFirst({ where: { id, deletedAt: null }, include: STYLE_INCLUDE });
  if (!s || !canViewStyle(user, s)) throw new HttpError(404, "Style not found.");
  return s;
}

export async function addHistory(
  tx: Tx,
  styleId: string,
  userId: string | null,
  description: string,
  extra: { field?: string; oldValue?: string | null; newValue?: string | null; mergeKey?: string } = {},
): Promise<void> {
  if (extra.mergeKey) {
    // Consecutive edits of the same text field by the same user collapse into one record.
    const last = await tx.historyEntry.findFirst({ where: { styleId }, orderBy: [{ timestamp: "desc" }, { id: "desc" }] });
    if (last && last.mergeKey === extra.mergeKey && last.userId === userId) {
      await tx.historyEntry.update({
        where: { id: last.id },
        data: { description, newValue: extra.newValue ?? null, timestamp: new Date() },
      });
      return;
    }
  }
  await tx.historyEntry.create({
    data: {
      styleId,
      userId,
      description,
      field: extra.field,
      oldValue: extra.oldValue ?? null,
      newValue: extra.newValue ?? null,
      mergeKey: extra.mergeKey,
    },
  });
}

async function defaultOwnerId(tx: Tx, step: Step, factoryId: string): Promise<string | null> {
  if (step.defaultOwner === null) return null;
  if (step.defaultOwner === "F") {
    return (await tx.user.findFirst({ where: { companyId: factoryId }, orderBy: { createdAt: "asc" } }))?.id ?? null;
  }
  return (
    (await tx.user.findFirst({ where: { name: step.defaultOwner, type: { in: ["ADMIN", "JUSTIN"] } }, orderBy: { createdAt: "asc" } }))?.id ?? null
  );
}

export interface NewStyle {
  pdNumber: string;
  collection: string;
  lineBuilderId: string | null;
  t1CompanyId: string;
  photo: string | null;
  createdById: string | null;
}

/** Creates the style with its 31 subitems in their initial status, default owners and default subscribers. */
export async function createStyle(tx: Tx, data: NewStyle): Promise<string> {
  const style = await tx.style.create({
    data: {
      pdNumber: data.pdNumber,
      collection: data.collection,
      lineBuilderId: data.lineBuilderId,
      t1CompanyId: data.t1CompanyId,
      photo: data.photo,
      createdById: data.createdById,
    },
  });

  const owners = new Map<string | null, string | null>();
  const rows = [];
  for (const step of STEPS) {
    if (!owners.has(step.defaultOwner)) owners.set(step.defaultOwner, await defaultOwnerId(tx, step, data.t1CompanyId));
    rows.push({ styleId: style.id, stepNo: step.no, round: 1, status: initialStatus(step), ownerId: owners.get(step.defaultOwner) ?? null });
  }
  await tx.subitem.createMany({ data: rows });

  const admins = await tx.user.findMany({ where: { type: "ADMIN" }, select: { id: true } });
  const subs = new Set(admins.map((a) => a.id));
  if (data.lineBuilderId) subs.add(data.lineBuilderId);
  await tx.notificationSubscription.createMany({ data: [...subs].map((userId) => ({ styleId: style.id, userId })) });
  return style.id;
}
