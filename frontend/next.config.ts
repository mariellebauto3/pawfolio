import type { NextConfig } from "next";

// Photos uploaded through the API (pet photos, post photos) are served by Laravel's public disk at
// `${NEXT_PUBLIC_API_URL}/storage/…`. next/image loads a remote image only from an origin listed here, so the API's
// storage path is the one allowed. The default matches src/config/env.ts.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
const isLocalApi = ["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname);
// Public bucket base URL only; credentials and private buckets stay on the backend.
// The existing production API uses this public bucket. Keep its exact path allowed even when an older Vercel
// deployment has not set NEXT_PUBLIC_STORAGE_URL; a supplied URL still selects a different environment's bucket.
const publicStorageUrl = process.env.NEXT_PUBLIC_STORAGE_URL || (
  apiUrl.hostname === "pawfolio-api.onrender.com"
    ? "https://wlqpmacbeirpoeibavgb.supabase.co/storage/v1/object/public/pawfolio-public"
    : undefined
);
const storagePattern = publicStorageUrl
  ? new URL(`${publicStorageUrl.replace(/\/+$/, "")}/**`)
  : null;
if (storagePattern && (storagePattern.protocol !== "https:" || storagePattern.username || storagePattern.password || storagePattern.search || storagePattern.hash)) {
  throw new Error("NEXT_PUBLIC_STORAGE_URL must be a public HTTPS bucket URL without credentials, query or fragment.");
}

const nextConfig: NextConfig = {
  // Keep Sanctum cookies on the frontend host so browser calls and server page guards share one session.
  // External rewrites forward requests and Set-Cookie without buffering uploads in a Route Handler.
  async rewrites() {
    return [
      { source: "/backend/api/v1/:path*", destination: `${apiUrl.origin}/api/v1/:path*` },
      { source: "/backend/sanctum/csrf-cookie", destination: `${apiUrl.origin}/sanctum/csrf-cookie` },
    ];
  },
  // Development only: Next.js draws its own badge over a corner of every page. The default corner, bottom left,
  // is where the admin sidebar ends (the signed-in admin and Log out) and where the phone tab bar starts, so the
  // badge covered them. Bottom right has nothing under it.
  devIndicators: { position: "bottom-right" },
  // A page that was opened is kept in the tab's memory for this many seconds, so going back to it by a link (Browse,
  // then Requests, then Browse again) shows it at once and asks the API nothing. Next.js keeps none by default for
  // pages rendered per request, which every signed-in page is. It stays short because another account can change
  // what a page shows; this account's own writes and a new notification drop the kept pages straight away
  // (src/lib/utils/page-refresher.ts). Memory only: a reload, signing in and logging out start from nothing.
  experimental: { staleTimes: { dynamic: 30 } },
  images: {
    remotePatterns: [new URL("/storage/**", apiUrl), ...(storagePattern ? [storagePattern] : [])],
    // The image optimizer refuses to fetch from an address on this machine unless told to. That is only ever the
    // API in local development; a hosted API has a public address and leaves this off.
    dangerouslyAllowLocalIP: isLocalApi,
  },
};

export default nextConfig;
