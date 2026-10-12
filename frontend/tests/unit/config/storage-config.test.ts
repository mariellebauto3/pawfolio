import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

async function imagePatterns(api: string, storage?: string) {
  vi.stubEnv("NEXT_PUBLIC_API_URL", api);
  vi.stubEnv("NEXT_PUBLIC_STORAGE_URL", storage);
  vi.resetModules();
  const { default: config } = await import("../../../next.config");
  return (config.images?.remotePatterns ?? []).filter((pattern): pattern is URL => pattern instanceof URL);
}

describe("deployed photo storage", () => {
  it("allows the existing production bucket when Vercel omitted the optional storage URL", async () => {
    const patterns = await imagePatterns("https://pawfolio-api.onrender.com");
    expect(patterns.map((pattern) => pattern.href)).toContain(
      "https://wlqpmacbeirpoeibavgb.supabase.co/storage/v1/object/public/pawfolio-public/**",
    );
    expect(patterns.some((pattern) => pattern.href.includes("pawfolio-private"))).toBe(false);
  });

  it("uses an explicitly configured bucket for another environment", async () => {
    const patterns = await imagePatterns(
      "https://pawfolio-api.onrender.com",
      "https://staging.supabase.co/storage/v1/object/public/staging-photos",
    );
    expect(patterns.map((pattern) => pattern.hostname)).not.toContain("wlqpmacbeirpoeibavgb.supabase.co");
    expect(patterns.map((pattern) => pattern.pathname)).toContain("/storage/v1/object/public/staging-photos/**");
  });

  it("keeps unrelated and local APIs restricted to their own storage", async () => {
    const patterns = await imagePatterns("http://localhost:8000");
    expect(patterns).toHaveLength(1);
    expect(patterns[0].href).toBe("http://localhost:8000/storage/**");
  });
});
