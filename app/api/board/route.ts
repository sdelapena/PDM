import { handler, requireUser } from "@/lib/api";
import { db } from "@/lib/db";
import { assert, canEdit, canSeeBoard, permsFor } from "@/lib/perm";
import { serializeStyle, STYLE_INCLUDE } from "@/lib/styles";

export const GET = handler(async () => {
  const me = await requireUser();
  assert(canSeeBoard(me));
  const factories = await db.company.findMany({
    where: { kind: "T1", active: true, ...(me.type === "T1" ? { id: me.companyId ?? "none" } : {}) },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const styles = await db.style.findMany({
    where: { deletedAt: null, t1CompanyId: { in: factories.map((f) => f.id) } },
    include: STYLE_INCLUDE,
    orderBy: [{ collection: "asc" }, { pdNumber: "asc" }],
  });
  const editor = canEdit(me);
  return {
    me: { id: me.id, name: me.name, type: me.type },
    perms: permsFor(me),
    factories,
    // Only internal users get the user directory.
    users: editor ? await db.user.findMany({ select: { id: true, name: true, type: true, isLineBuilder: true, companyId: true }, orderBy: { name: "asc" } }) : [],
    styles: styles.map(serializeStyle),
  };
});
