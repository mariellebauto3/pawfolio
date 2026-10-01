// Laravel sets XSRF-TOKEN as a readable cookie; the client echoes it back in the X-XSRF-TOKEN header on every write
// so Laravel can check the request came from our own pages (CSRF protection, SEC-AUTH-06). The session cookie
// itself is HttpOnly and never touched by JavaScript.
export const XSRF_COOKIE = "XSRF-TOKEN";
export const XSRF_HEADER = "X-XSRF-TOKEN";

/** Reads one cookie from a `Cookie` header string (`a=1; b=2`). Returns the decoded value or null. */
export function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** Reads a cookie the page can see. Always null on the server. */
export function readBrowserCookie(name: string): string | null {
  return typeof document === "undefined" ? null : readCookie(document.cookie, name);
}
