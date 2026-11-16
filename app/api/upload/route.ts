import { handler, HttpError, requireUser } from "@/lib/api";
import { assert, canEdit } from "@/lib/perm";
import { storePhoto } from "@/lib/storage";

export const POST = handler(async (req) => {
  const me = await requireUser();
  assert(canEdit(me));
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file received.");
  return { url: await storePhoto(file) };
});
