import { type NextRequest, NextResponse } from "next/server";
import { needsAccountLookup } from "@/lib/auth/lookup-account";
import { routeRedirect } from "@/lib/auth/redirects";

// Cookie presence is only an optimistic check. The root layout verifies the account
// once per render, and Laravel independently authorizes every API request.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!needsAccountLookup(request.headers.get("cookie"))) {
    const target = routeRedirect(`${pathname}${search}`, null);
    if (target) return NextResponse.redirect(new URL(target, request.url));
  }
  // Overwrite caller-supplied values so the layout checks the actual requested route.
  const headers = new Headers(request.headers);
  headers.set("x-pawfolio-path", `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico$|icon.svg$|apple-icon.png$).*)"],
};
