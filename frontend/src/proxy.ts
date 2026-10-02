import { type NextRequest, NextResponse } from "next/server";
import { lookUpAccount } from "@/lib/auth/lookup-account";
import { routeArea, routeRedirect } from "@/lib/auth/redirects";

// Optimistic redirects only (SEC-FE-06): signed out → /sign-in, not Active → /account-status, not an admin → away
// from /admin. This is never the access check — every page's data comes from the API, which enforces the same rules
// on its own. If the API can't be asked, the request goes through and the page handles what the API answers.

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (routeArea(pathname) === "public") return NextResponse.next();

  const account = await lookUpAccount(request.headers.get("cookie"));
  if (account === undefined) return NextResponse.next();

  const target = routeRedirect(`${pathname}${search}`, account);
  return target ? NextResponse.redirect(new URL(target, request.url)) : NextResponse.next();
}

export const config = {
  // Pages only: skip Next.js internals and files with an extension (images, icons, fonts).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
