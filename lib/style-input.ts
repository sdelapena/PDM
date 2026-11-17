import { HttpError, str } from "./api";
import { db } from "./db";
import { isStoredPhotoUrl } from "./storage";

/** Validates the header fields shared by Add style and Edit. */
export async function parseHeader(b: Record<string, unknown>) {
  const collection = str(b.collection ?? "", 80);
  const lineBuilderId = typeof b.lineBuilderId === "string" ? b.lineBuilderId : "";
  if (!lineBuilderId) throw new HttpError(400, "Line Builder is required.");
  const lb = await db.user.findUnique({ where: { id: lineBuilderId } });
  if (!lb || !lb.isLineBuilder || (lb.type !== "ADMIN" && lb.type !== "JUSTIN")) throw new HttpError(400, "Choose a valid Line Builder.");

  let photo: string | null = null;
  if (typeof b.photo === "string" && b.photo) {
    if (!isStoredPhotoUrl(b.photo)) throw new HttpError(400, "Invalid photo.");
    photo = b.photo;
  }
  return { collection, lineBuilderId, lineBuilderName: lb.name, photo };
}
