import { body, handler, HttpError, requireUser, str } from "@/lib/api";
import { db } from "@/lib/db";
import { assert, isAdmin } from "@/lib/perm";

export const GET = handler(async () => {
  const me = await requireUser();
  assert(isAdmin(me));
  const rows = await db.company.findMany({ include: { _count: { select: { users: true } } }, orderBy: { createdAt: "asc" } });
  return { companies: rows.map((c) => ({ id: c.id, name: c.name, kind: c.kind, active: c.active, users: c._count.users })) };
});

export const POST = handler(async (req) => {
  const me = await requireUser();
  assert(isAdmin(me));
  const b = await body(req);
  const name = str(b.name ?? "", 80);
  const kind = b.kind === "T1" || b.kind === "T2" ? b.kind : null;
  if (!name || !kind) throw new HttpError(400, "Enter a company name.");
  if (await db.company.findFirst({ where: { kind, name: { equals: name, mode: "insensitive" } } })) throw new HttpError(409, `${name} already exists.`);
  await db.company.create({ data: { name, kind } });
  return { ok: true };
});
