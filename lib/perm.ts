// Permission matrix (spec 2.1). Enforced in every API route.
import type { User } from "@prisma/client";
import { HttpError } from "./api";

type U = Pick<User, "type" | "isLineBuilder" | "companyId">;

export const isAdmin = (u: U) => u.type === "ADMIN";
/** Edit subitems, prices, style header and notification lists. */
export const canEdit = (u: U) => u.type === "ADMIN" || u.type === "JUSTIN";
/** Add, duplicate and cancel styles. */
export const canManageStyles = (u: U) => u.type === "ADMIN" || (u.type === "JUSTIN" && u.isLineBuilder);
export const canSeeBoard = (u: U) => u.type !== "T2";
export const canViewStyle = (u: U, style: { t1CompanyId: string }) =>
  canEdit(u) || (u.type === "T1" && !!u.companyId && u.companyId === style.t1CompanyId);

export function assert(ok: boolean, message = "You don't have permission to do that."): asserts ok {
  if (!ok) throw new HttpError(403, message);
}

export function permsFor(u: U) {
  return { admin: isAdmin(u), edit: canEdit(u), manageStyles: canManageStyles(u) };
}
