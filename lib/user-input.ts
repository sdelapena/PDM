import type { UserType } from "@prisma/client";
import { HttpError } from "./api";
import { db } from "./db";

const TYPES: UserType[] = ["ADMIN", "JUSTIN", "T1", "T2"];

export function parseType(v: unknown): UserType {
  if (typeof v !== "string" || !TYPES.includes(v as UserType)) throw new HttpError(400, "Choose a user type.");
  return v as UserType;
}

export function parseEmail(v: unknown): string {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) throw new HttpError(400, "Enter a valid email.");
  return e;
}

/** T1/T2 users belong to exactly one company of the matching kind; Admin and Justin users to none. */
export async function resolveCompany(type: UserType, companyId: unknown): Promise<string | null> {
  if (type !== "T1" && type !== "T2") return null;
  const c = typeof companyId === "string" ? await db.company.findFirst({ where: { id: companyId, kind: type } }) : null;
  if (!c) throw new HttpError(400, `Choose a ${type} company for this user.`);
  return c.id;
}
