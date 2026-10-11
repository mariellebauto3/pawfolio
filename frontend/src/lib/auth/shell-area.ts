import type { Account } from "@/types/account";

/** The page shell an account belongs in (ui-guidelines §1). */
export type ShellArea = "guest" | "account-status" | "member" | "admin";

/**
 * For pages that aren't inside one route group, such as the app-wide not-found page. Like the redirects, this only
 * picks what to show; the API decides what each account may do.
 */
export function shellAreaFor(account: Account | null): ShellArea {
  if (!account) return "guest";
  if (account.status !== "active") return "account-status";
  return account.role === "admin" ? "admin" : "member";
}
