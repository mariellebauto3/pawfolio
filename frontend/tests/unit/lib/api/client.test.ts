import { afterEach, describe, expect, it, vi } from "vitest";

describe("error listeners", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("a failing listener doesn't replace the ApiError the caller gets", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Taken." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })));
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    const { api, onApiError } = await import("@/lib/api/client");

    const stop = onApiError(() => {
      throw new Error("listener broke");
    });
    await expect(api.get("/pets")).rejects.toMatchObject({ kind: "conflict", message: "Taken." });
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "listener broke" }));
    stop();
  });
});
