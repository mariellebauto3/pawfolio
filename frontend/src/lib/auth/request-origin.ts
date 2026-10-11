import { env } from "@/config/env";

/** Use the public host of this request, including Vercel preview deployments. */
export function requestOrigin(headers: Headers): string {
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (!host || /[,\s]/.test(host)) return env.appUrl;
  const protocol = headers.get("x-forwarded-proto") || new URL(env.appUrl).protocol.slice(0, -1);
  if (protocol !== "http" && protocol !== "https") return env.appUrl;
  try {
    const url = new URL(`${protocol}://${host}`);
    if (url.host !== host || url.username || url.password) return env.appUrl;
    return url.origin;
  } catch {
    return env.appUrl;
  }
}
