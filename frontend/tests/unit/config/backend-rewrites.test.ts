import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("same-origin Laravel rewrites", () => {
  it("forwards only API and CSRF paths to the configured backend", async () => {
    const rewrites = await nextConfig.rewrites!();
    const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").origin;
    expect(rewrites).toEqual([
      { source: "/backend/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` },
      { source: "/backend/sanctum/csrf-cookie", destination: `${apiOrigin}/sanctum/csrf-cookie` },
    ]);
  });
});
