import { ROUTES } from "@/constants/routes";
import { routeArea, safeNextPath } from "@/lib/auth/redirects";

/**
 * The page a notification opens, or null when it should open nothing.
 *
 * `action_url` is data from the API, and one endpoint lets an account write its own, so it is followed only when it
 * is a path on this site (SEC-FE-07) inside the pages a member can open. A link to the Notifications page itself
 * would lead back to the list it is read on, so it counts as no link.
 */
export function notificationHref(actionUrl: string | null | undefined): string | null {
  const path = safeNextPath(actionUrl);
  if (!path) return null;
  const { pathname } = new URL(path, "http://pawfolio.invalid");
  if (routeArea(pathname) !== "member" || pathname === ROUTES.notifications) return null;
  return path;
}
