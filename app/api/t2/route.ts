import { dateToIso, handler, requireUser } from "@/lib/api";
import { STEP_BY_NO, stepTitle } from "@/lib/catalog";
import { db } from "@/lib/db";
import { assert } from "@/lib/perm";

// The only data a T2 user can read: the subitems they own. No prices, discussion or other steps.
export const GET = handler(async () => {
  const me = await requireUser();
  assert(me.type === "T2");
  const company = me.companyId ? await db.company.findUnique({ where: { id: me.companyId }, select: { name: true } }) : null;
  const mine = await db.subitem.findMany({
    where: { ownerId: me.id, style: { deletedAt: null, cancelledAt: null, t1Company: { active: true } } },
    select: {
      id: true, styleId: true, stepNo: true, round: true, status: true, reqDate: true, confDate: true, realDate: true, description: true,
      style: { select: { pdNumber: true, collection: true, firstPoDate: true, t1Company: { select: { name: true } } } },
    },
  });
  const counts = await db.subitem.groupBy({
    by: ["styleId", "stepNo"],
    where: { styleId: { in: [...new Set(mine.map((x) => x.styleId))] } },
    _max: { round: true },
  });
  const total = new Map(counts.map((c) => [`${c.styleId}|${c.stepNo}`, c._max.round ?? 1]));
  const rows = mine
    .sort((a, b) => a.style.collection.localeCompare(b.style.collection) || +a.style.firstPoDate - +b.style.firstPoDate || a.style.pdNumber.localeCompare(b.style.pdNumber) || a.stepNo - b.stepNo || a.round - b.round)
    .map((x) => {
      const rounds = total.get(`${x.styleId}|${x.stepNo}`) ?? 1;
      return {
        id: x.id,
        pdNumber: x.style.pdNumber,
        factory: x.style.t1Company.name,
        stepNo: x.stepNo,
        subitem: stepTitle(STEP_BY_NO[x.stepNo], x.round, rounds),
        latest: x.round === rounds,
        status: x.status,
        reqDate: dateToIso(x.reqDate),
        confDate: dateToIso(x.confDate),
        realDate: dateToIso(x.realDate),
        description: x.description,
      };
    });
  return { me: { name: me.name, company: company?.name ?? "" }, rows };
});
