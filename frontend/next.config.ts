import type { NextConfig } from "next";

// Photos uploaded through the API (pet photos, post photos) are served by Laravel's public disk at
// `${NEXT_PUBLIC_API_URL}/storage/…`. next/image loads a remote image only from an origin listed here, so the API's
// storage path is the one allowed. The default matches src/config/env.ts.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
const isLocalApi = ["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname);

const nextConfig: NextConfig = {
  // Development only: Next.js draws its own badge over a corner of every page. The default corner, bottom left,
  // is where the admin sidebar ends (the signed-in admin and Log out) and where the phone tab bar starts, so the
  // badge covered them. Bottom right has nothing under it.
  devIndicators: { position: "bottom-right" },
  images: {
    remotePatterns: [new URL("/storage/**", apiUrl)],
    // The image optimizer refuses to fetch from an address on this machine unless told to. That is only ever the
    // API in local development; a hosted API has a public address and leaves this off.
    dangerouslyAllowLocalIP: isLocalApi,
  },
};

export default nextConfig;
