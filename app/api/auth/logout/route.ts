import { handler } from "@/lib/api";
import { destroySession } from "@/lib/session";

export const POST = handler(async () => {
  await destroySession();
  return { ok: true };
});
