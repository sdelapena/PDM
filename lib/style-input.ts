import { HttpError, isoToDate, str } from "./api";
import { db } from "./db";
import { isStoredPhotoUrl } from "./storage";

/** Validates the header fields shared by Add style and Edit. */
export async function parseHeader(b: Record<string, unknown>) {
  const collection = str(b.collection ?? "", 80);
  const lineBuilderId = typeof b.lineBuilderId === "string" ? b.lineBuilderId : "";
  if (!lineBuilderId) throw new HttpError(400, "Line Builder is required.");
  const lb = await db.user.findUnique({ where: { id: lineBuilderId } });
  if (!lb || !lb.isLineBuilder || (lb.type !== "ADMIN" && lb.type !== "JUSTIN")) throw new HttpError(400, "Choose a valid Line Builder.");

  const raw = Array.isArray(b.t2) ? b.t2 : [];
  const t2 = [0, 1].map((i) => (typeof raw[i] === "string" && raw[i] ? (raw[i] as string) : null));
  if (t2[0] && t2[0] === t2[1]) throw new HttpError(400, "T2 #1 and T2 #2 must be different suppliers.");
  for (const id of t2) {
    if (id && !(await db.company.findFirst({ where: { id, kind: "T2" } }))) throw new HttpError(400, "Choose a valid T2.");
  }
  if (!b.firstPoDate) throw new HttpError(400, "First PO Date is required.");
  const firstPoDate = isoToDate(b.firstPoDate);

  let photo: string | null = null;
  if (typeof b.photo === "string" && b.photo) {
    if (!isStoredPhotoUrl(b.photo)) throw new HttpError(400, "Invalid photo.");
    photo = b.photo;
  }
  return { collection, lineBuilderId, lineBuilderName: lb.name, t2, firstPoDate, photo };
}
