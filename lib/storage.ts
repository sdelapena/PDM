import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./api";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
// Vercel rejects request bodies over 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024;

export async function storePhoto(file: File): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(400, "Photos must be JPG, PNG, WebP or GIF.");
  if (file.size > MAX_BYTES) throw new HttpError(400, "Photos must be 4 MB or smaller.");
  const name = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "pdm-photos";
  if (url && key) {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.storage.from(bucket).upload(name, bytes, { contentType: file.type });
    if (error) {
      console.error("Supabase upload error", error);
      throw new HttpError(502, "The photo could not be stored.");
    }
    return supabase.storage.from(bucket).getPublicUrl(name).data.publicUrl;
  }
  if (process.env.NODE_ENV === "production") throw new HttpError(503, "Photo storage is not configured.");
  // Local development without Supabase.
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/${name}`;
}

/** Only URLs produced by storePhoto are accepted from clients. */
export function isStoredPhotoUrl(u: string): boolean {
  if (u.startsWith("/uploads/") && process.env.NODE_ENV !== "production") return /^\/uploads\/[\w-]+\.\w+$/.test(u);
  const base = process.env.SUPABASE_URL;
  const bucket = process.env.SUPABASE_BUCKET || "pdm-photos";
  return !!base && u.startsWith(`${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/`);
}
