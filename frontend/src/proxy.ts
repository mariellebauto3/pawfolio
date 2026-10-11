import { type NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/constants/routes";
import { lookUpAccount } from "@/lib/auth/lookup-account";
import { routeArea, routeRedirect } from "@/lib/auth/redirects";

// Verify navigation before any page, metadata or loading UI can be rendered.
// Laravel independently authorizes every API request. An unavailable session check fails closed.

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (routeArea(pathname) === "public" && pathname !== ROUTES.landing && pathname !== ROUTES.adminsOnly) return NextResponse.next();

  const account = await lookUpAccount(request.headers.get("cookie"));
  if (account === undefined) {
    return new NextResponse("We couldn't verify your session. Please try again.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const target = routeRedirect(`${pathname}${search}`, account);
  return target ? NextResponse.redirect(new URL(target, request.url)) : NextResponse.next();
}

export const config = {
  // Skip only framework internals and public assets; dots in a module URL do not bypass the check.
  matcher: ["/((?!_next/static|_next/image|images/|favicon.ico$|icon.svg$|apple-icon.png$).*)"],
};
