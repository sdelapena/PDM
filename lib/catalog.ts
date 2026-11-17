// Fixed catalog of the 31 subitems (spec section 5). Shared by server and client.

export type Status =
  | "NOT_STARTED"
  | "NOT_DELIVERED"
  | "DELIVERED"
  | "REQUESTED"
  | "REJECTED"
  | "RECEIVED"
  | "IN_PROGRESS"
  | "IN_PROCESS"
  | "APPROVED"
  | "NA"
  | "CALCULATING"
  | "SENT"
  | "UPLOADED"
  | "PENDING"
  | "REJECTED_MX"
  | "REJECTED_USA";

export const STATUS_LABEL: Record<Status, string> = {
  NOT_STARTED: "Not Started",
  NOT_DELIVERED: "Not Delivered",
  DELIVERED: "Delivered",
  REQUESTED: "Requested",
  REJECTED: "Rejected",
  RECEIVED: "Received",
  IN_PROGRESS: "In Progress",
  IN_PROCESS: "In Process",
  APPROVED: "Approved",
  NA: "N/A",
  CALCULATING: "Calculating",
  SENT: "Sent",
  UPLOADED: "Uploaded",
  PENDING: "Pending",
  REJECTED_MX: "Rejected MX",
  REJECTED_USA: "Rejected USA",
};

export const COMPLETE: ReadonlySet<string> = new Set(["APPROVED", "DELIVERED", "RECEIVED", "UPLOADED", "NA"]);
export const REJECTED: ReadonlySet<string> = new Set(["REJECTED", "REJECTED_MX", "REJECTED_USA"]);
export const OPEN: ReadonlySet<string> = new Set([
  "PENDING",
  "REQUESTED",
  "IN_PROGRESS",
  "IN_PROCESS",
  "SENT",
  "CALCULATING",
  "REJECTED",
  "REJECTED_MX",
  "REJECTED_USA",
]);

export type DateMode = "RCR" | "DATE" | "NONE";
export type Field = "price" | "targetPrice" | "pairs" | "tracking" | "leather" | "material" | "photo";
// F = first T1 user of the factory; null = no owner (assigned by hand); otherwise a Justin/Admin user name.
export type DefaultOwner = "F" | null | (string & {});

export interface Step {
  no: number;
  section: number;
  name: string;
  statuses: Status[];
  dates: DateMode;
  fields: Field[];
  rounds?: boolean;
  auto?: "targetPrice" | "photo";
  autoDates?: boolean; // REQ/CONF filled when it moves to Requested
  defaultOwner: DefaultOwner;
}

export const SECTIONS = [
  { name: "Design", letter: "D" },
  { name: "Commercial", letter: "C" },
  { name: "Operations", letter: "O" },
  { name: "Technical", letter: "T" },
  { name: "Production", letter: "P" },
] as const;

const BRIEF: Status[] = ["NOT_DELIVERED", "DELIVERED"];
const SPECS: Status[] = ["NOT_STARTED", "DELIVERED"];
const LEATHER: Status[] = ["NOT_STARTED", "REQUESTED", "REJECTED", "RECEIVED"];
const PRICE: Status[] = ["NOT_STARTED", "CALCULATING", "SENT", "APPROVED"];
const PHOTO: Status[] = ["NOT_STARTED", "UPLOADED"];
const SAMPLE: Status[] = ["NOT_STARTED", "REQUESTED", "IN_PROCESS", "SENT", "REJECTED_MX", "REJECTED_USA", "APPROVED"];
const GENERIC: Status[] = ["NOT_STARTED", "PENDING", "IN_PROGRESS", "APPROVED", "NA"];
const WINDOW: Status[] = ["NOT_STARTED", "NA", "APPROVED"];

function s(
  no: number,
  section: number,
  name: string,
  statuses: Status[],
  dates: DateMode,
  fields: Field[],
  defaultOwner: DefaultOwner,
  extra: Partial<Step> = {},
): Step {
  return { no, section, name, statuses, dates, fields, defaultOwner, ...extra };
}

export const STEPS: Step[] = [
  s(1, 0, "Project Brief", BRIEF, "DATE", [], "Sebastián"),
  s(2, 0, "Target Price", ["NOT_STARTED", "DELIVERED"], "NONE", ["targetPrice"], "Paul", { auto: "targetPrice" }),
  s(3, 0, "Proto Specs", BRIEF, "DATE", [], "Sebastián"),
  s(4, 0, "Leather Shaft", LEATHER, "RCR", ["leather"], null, { autoDates: true }),
  s(5, 0, "Leather Vamp", LEATHER, "RCR", ["leather"], null, { autoDates: true }),
  s(6, 0, "Proto", ["NOT_STARTED", "IN_PROGRESS", "APPROVED", "NA"], "RCR", ["tracking"], "F"),
  s(7, 0, "Proto Price", PRICE, "NONE", ["price"], "F"),
  s(8, 0, "Photo", PHOTO, "NONE", ["photo"], "Edna", { auto: "photo" }),

  s(9, 1, "Specs", SPECS, "DATE", [], "Paul"),
  s(10, 1, "Leather Vamp", LEATHER, "RCR", ["leather"], null, { autoDates: true }),
  s(11, 1, "Leather Shaft", LEATHER, "RCR", ["leather"], null, { autoDates: true }),
  s(12, 1, "Material 3", LEATHER, "RCR", ["material"], null, { autoDates: true }),
  s(13, 1, "Sales Samples", SAMPLE, "RCR", ["pairs", "tracking"], "F"),
  s(14, 1, "Go By Samples", SAMPLE, "RCR", ["pairs", "tracking"], "Bubba"),
  s(15, 1, "Packing Definition", ["NOT_STARTED", "DELIVERED", "NA"], "DATE", [], "Gerardo"),
  s(16, 1, "Final Price", PRICE, "NONE", ["price"], "F"),
  s(17, 1, "Photo", PHOTO, "NONE", ["photo"], "Edna", { auto: "photo" }),

  s(18, 2, "IFIs & USMCA", GENERIC, "NONE", [], "Gerardo"),
  s(19, 2, "Confirmed Price", PRICE, "NONE", ["price"], "F"),
  s(20, 2, "UPC", GENERIC, "NONE", [], "Bubba"),
  s(21, 2, "Shelf Talker", GENERIC, "NONE", [], "Bubba"),
  s(22, 2, "Confirmed Packing", GENERIC, "NONE", [], "Gerardo"),

  s(23, 3, "Leather Window", WINDOW, "DATE", [], "Edna"),
  s(24, 3, "Leather Master", WINDOW, "DATE", [], "Edna"),
  s(25, 3, "Fit Samples", SAMPLE, "RCR", ["tracking"], "Sebastián", { rounds: true }),
  s(26, 3, "Lab Samples", SAMPLE, "RCR", ["tracking"], "Gerardo", { rounds: true }),
  s(27, 3, "ASTM", GENERIC, "RCR", [], "Gerardo"),

  s(28, 4, "Outsole Molds", ["NOT_STARTED", "IN_PROGRESS", "APPROVED", "NA"], "RCR", [], null),
  s(29, 4, "Pilot Run", ["NOT_STARTED", "IN_PROCESS", "REJECTED_MX", "APPROVED"], "RCR", [], "F"),
  s(30, 4, "Lead", GENERIC, "RCR", [], "F"),
  s(31, 4, "Materials", GENERIC, "RCR", [], "F"),
];

export const STEP_BY_NO: Record<number, Step> = Object.fromEntries(STEPS.map((x) => [x.no, x]));

export const PROTO_PRICE_STEP = 7;
export const FINAL_PRICE_STEP = 16;

export function initialStatus(step: Step): Status {
  return step.statuses[0];
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as Status] ?? status;
}

export function stepTitle(step: Step, round: number, totalRounds: number): string {
  return step.rounds && totalRounds > 1 ? `${step.name} · Round ${round}` : step.name;
}

// Pill palette from the mockup.
export interface Pill {
  bg: string;
  fg: string;
  dash?: boolean;
}
const P_NONE: Pill = { bg: "#ffffff", fg: "#5f6475", dash: true };
const P_PENDING: Pill = { bg: "#dfe4f2", fg: "#2c3a5e" };
const P_PROGRESS: Pill = { bg: "#ffe4bd", fg: "#6e3d00" };
const P_DONE: Pill = { bg: "#cdeedb", fg: "#0d4f30" };
const P_NA: Pill = { bg: "#f1f2f5", fg: "#4f5465" };
const P_REJ: Pill = { bg: "#fbd5d7", fg: "#8a1621" };
const P_REJ_USA: Pill = { bg: "#f3b9be", fg: "#6e0f19" };
const P_SENT: Pill = { bg: "#d3eef1", fg: "#0b4a52" };

export function statusPill(status: string, step?: Step): Pill {
  switch (status) {
    case "NOT_STARTED":
    case "NOT_DELIVERED":
      return P_NONE;
    case "PENDING":
    case "REQUESTED":
    case "CALCULATING":
      return P_PENDING;
    case "IN_PROGRESS":
    case "IN_PROCESS":
      return P_PROGRESS;
    case "SENT":
      return step?.fields.includes("price") ? P_PROGRESS : P_SENT;
    case "APPROVED":
    case "DELIVERED":
    case "RECEIVED":
    case "UPLOADED":
      return P_DONE;
    case "NA":
      return P_NA;
    case "REJECTED":
    case "REJECTED_MX":
      return P_REJ;
    case "REJECTED_USA":
      return P_REJ_USA;
    default:
      return P_NONE;
  }
}
