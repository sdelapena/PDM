import { NextResponse, type NextRequest } from "next/server";
import { Prisma, type User } from "@prisma/client";
import { currentUser } from "./session";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handler<C>(fn: (req: NextRequest, ctx: C) => Promise<unknown>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "That value already exists." }, { status: 409 });
      }
      console.error(e);
      return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
    }
  };
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Not signed in.");
  return u;
}

export async function body(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, "Invalid request body.");
}

export function str(v: unknown, max = 200): string {
  if (typeof v !== "string") throw new HttpError(400, "Invalid value.");
  return v.trim().slice(0, max);
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function isoToDate(v: unknown): Date {
  if (typeof v !== "string" || !ISO.test(v)) throw new HttpError(400, "Invalid date.");
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid date.");
  return d;
}
export function isoToDateOrNull(v: unknown): Date | null {
  return v === null || v === "" ? null : isoToDate(v);
}
export function dateToIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
