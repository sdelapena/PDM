// Calculated statuses (spec section 6). Pure functions shared by server and client.
import { COMPLETE, OPEN, REJECTED, SECTIONS, STEP_BY_NO, STEPS } from "./catalog";

export interface SubLike {
  stepNo: number;
  round: number;
  status: string;
  confDate: string | null;
  targetPrice?: string | null;
}

export type StyleStatus = "CANCELLED" | "FINALIZED" | "AT_RISK" | "ON_TIME";
export type SectionState = "COMPLETE" | "ALERT" | "IN_PROGRESS" | "NOT_STARTED";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const p = iso.slice(0, 10).split("-");
  return `${p[2]}-${MONTHS[+p[1] - 1]}-${p[0].slice(2)}`;
}

export function fmtDateTime(isoTs: string, timeZone?: string): string {
  const d = new Date(isoTs);
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(d);
  const g = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}-${g("month")}-${g("year")} ${g("hour")}:${g("minute")}`;
}

export function fmtPrice(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "";
}

export function todayISO(timeZone?: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Target Price is automatic: Delivered as soon as it has a value. */
export function effectiveStatus(sub: SubLike): string {
  if (STEP_BY_NO[sub.stepNo]?.auto === "targetPrice") {
    return sub.targetPrice !== null && sub.targetPrice !== undefined && sub.targetPrice !== "" ? "DELIVERED" : "NOT_STARTED";
  }
  return sub.status;
}

export function isComplete(sub: SubLike): boolean {
  return COMPLETE.has(effectiveStatus(sub));
}

export function isLate(sub: SubLike, today: string): boolean {
  return OPEN.has(effectiveStatus(sub)) && !!sub.confDate && sub.confDate < today;
}

/** Only the latest round of a step counts; earlier rounds are kept as a record. */
export function latestRounds<T extends SubLike>(subs: T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const x of subs) {
    const cur = m.get(x.stepNo);
    if (!cur || x.round > cur.round) m.set(x.stepNo, x);
  }
  return m;
}

export function hasAlert(sub: SubLike, isLatest: boolean, today: string): boolean {
  if (!isLatest) return false;
  return REJECTED.has(effectiveStatus(sub)) || isLate(sub, today);
}

export function styleStatus(subs: SubLike[], cancelled: boolean, today: string): StyleStatus {
  if (cancelled) return "CANCELLED";
  const latest = latestRounds(subs);
  if (STEPS.every((st) => { const x = latest.get(st.no); return !!x && isComplete(x); })) return "FINALIZED";
  for (const x of latest.values()) if (hasAlert(x, true, today)) return "AT_RISK";
  return "ON_TIME";
}

export function sectionStates(subs: SubLike[], today: string): { state: SectionState; done: number; total: number }[] {
  const latest = latestRounds(subs);
  return SECTIONS.map((_, idx) => {
    const steps = STEPS.filter((st) => st.section === idx);
    const cur = steps.map((st) => latest.get(st.no)).filter((x): x is SubLike => !!x);
    const done = cur.filter(isComplete).length;
    const total = steps.length;
    let state: SectionState;
    if (done === total) state = "COMPLETE";
    else if (cur.some((x) => hasAlert(x, true, today))) state = "ALERT";
    else if (cur.some((x) => !["NOT_STARTED", "NOT_DELIVERED"].includes(effectiveStatus(x)))) state = "IN_PROGRESS";
    else state = "NOT_STARTED";
    return { state, done, total };
  });
}

export const STYLE_STATUS_UI: Record<StyleStatus, { label: string; bg: string; fg: string }> = {
  AT_RISK: { label: "At Risk", bg: "#fbd5d7", fg: "#8a1621" },
  ON_TIME: { label: "On Time", bg: "#d6e3ff", fg: "#1d3f94" },
  FINALIZED: { label: "Finalized", bg: "#cdeedb", fg: "#0d4f30" },
  CANCELLED: { label: "Cancelled", bg: "#4a4f60", fg: "#ffffff" },
};

export const SECTION_STATE_UI: Record<SectionState, { label: string; bg: string; fg: string }> = {
  COMPLETE: { label: "Complete", bg: "rgba(47,158,104,0.22)", fg: "#0d4f30" },
  ALERT: { label: "Alert", bg: "rgba(224,82,93,0.22)", fg: "#8a1621" },
  IN_PROGRESS: { label: "In progress", bg: "rgba(47,95,208,0.18)", fg: "#1d3f94" },
  NOT_STARTED: { label: "Not started", bg: "rgba(140,148,170,0.16)", fg: "#4f5465" },
};
