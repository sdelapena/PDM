import { body, handler, HttpError, requireUser, str } from "@/lib/api";
import { db } from "@/lib/db";
import { assert, canManageStyles } from "@/lib/perm";
import { parseHeader } from "@/lib/style-input";
import { addHistory, createStyle, loadStyle, serializeStyle } from "@/lib/styles";

export const POST = handler(async (req) => {
  const me = await requireUser();
  assert(canManageStyles(me));
  const b = await body(req);
  const pdNumber = str(b.pdNumber ?? "", 40);
  if (!pdNumber) throw new HttpError(400, "PD # / SKU is required.");
  const factory = await db.company.findFirst({ where: { id: typeof b.factoryId === "string" ? b.factoryId : "", kind: "T1", active: true } });
  if (!factory) throw new HttpError(400, "Choose a factory.");
  const h = await parseHeader(b);
  // Soft-deleted styles keep their PD # reserved so they can be recovered.
  if (await db.style.findFirst({ where: { pdNumber: { equals: pdNumber, mode: "insensitive" } } })) {
    throw new HttpError(409, `PD # / SKU ${pdNumber} already exists.`);
  }
  const source = typeof b.duplicateOfId === "string" ? await loadStyle(me, b.duplicateOfId) : null;

  const id = await db.$transaction(async (tx) => {
    const styleId = await createStyle(tx, {
      pdNumber,
      collection: h.collection,
      lineBuilderId: h.lineBuilderId,
      t1CompanyId: factory.id,
      t2: h.t2,
      firstPoDate: h.firstPoDate,
      photo: h.photo,
      createdById: me.id,
    });
    await addHistory(tx, styleId, me.id, source ? `Style created as a duplicate of ${source.pdNumber}` : "Style created", { field: "created" });
    return styleId;
  });
  return serializeStyle(await loadStyle(me, id));
});
