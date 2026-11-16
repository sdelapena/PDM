import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { currentUser } from "./session";

/** Page-level gate. The API routes enforce the same rules on their own. */
export async function gate(allow: (u: User) => boolean): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (!allow(u)) redirect(u.type === "T2" ? "/t2" : "/");
  return u;
}
