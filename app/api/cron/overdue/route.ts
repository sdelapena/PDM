// Daily job (see vercel.json): emails subscribers once per subitem when its CONF date passes while still open.
import { dateToIso, handler, HttpError } from "@/lib/api";
import { OPEN, statusLabel, STEP_BY_NO, stepTitle } from "@/lib/catalog";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/logic";
import { notifyStyle } from "@/lib/notify";
import { serverToday } from "@/lib/styles";

export const GET = handler(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorized.");
  const today = new Date(serverToday() + "T00:00:00Z");
  const candidates = await db.subitem.findMany({
    where: { confDate: { lt: today }, status: { in: [...OPEN] }, style: { deletedAt: null, cancelledAt: null, t1Company: { active: true } } },
    include: { style: { select: { subitems: { select: { stepNo: true, round: true } } } } },
  });
  const byStyle = new Map<string, { ids: string[]; lines: string[] }>();
  for (const x of candidates) {
    const rounds = x.style.subitems.filter((y) => y.stepNo === x.stepNo).length;
    if (x.round !== rounds) continue;
    if (dateToIso(x.overdueNotifiedFor) === dateToIso(x.confDate)) continue;
    const g = byStyle.get(x.styleId) ?? { ids: [], lines: [] };
    g.ids.push(x.id);
    g.lines.push(`${stepTitle(STEP_BY_NO[x.stepNo], x.round, rounds)}: ${statusLabel(x.status)}, CONF ${fmtDate(dateToIso(x.confDate))}`);
    byStyle.set(x.styleId, g);
  }
  for (const [styleId, g] of byStyle) {
    await notifyStyle(styleId, null, "Confirmed date passed", ["These steps passed their confirmed date and are still open:", ...g.lines]);
    for (const id of g.ids) {
      const s = candidates.find((c) => c.id === id)!;
      await db.subitem.update({ where: { id }, data: { overdueNotifiedFor: s.confDate } });
    }
  }
  return { styles: byStyle.size };
});
