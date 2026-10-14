import { afterEach, describe, expect, it, vi } from "vitest";

describe("error listeners", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("uses the frontend origin for CSRF and sign-in so the page guard receives the session cookie", async () => {
    vi.stubGlobal("window", { location: { origin: "https://pawfolio-service.vercel.app" } });
    vi.stubGlobal("document", { cookie: "" });
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/sanctum/csrf-cookie")) {
        document.cookie = "XSRF-TOKEN=csrf-token";
        return new Response(null, { status: 204 });
      }
      return Response.json({ data: { id: 1 } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("@/lib/api/client");
    await api.post("/auth/sign-in", { email: "test@example.com", password: "password" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://pawfolio-service.vercel.app/backend/sanctum/csrf-cookie",
      "https://pawfolio-service.vercel.app/backend/api/v1/auth/sign-in",
    ]);
    const init = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1];
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("X-XSRF-TOKEN")).toBe("csrf-token");
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

  it("tells write listeners about an accepted write until they stop listening", async () => {
    vi.stubGlobal("window", { location: { origin: "https://pawfolio-service.vercel.app" } });
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=csrf-token" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: {} })));
    const { api, onApiWrite } = await import("@/lib/api/client");

    const listener = vi.fn();
    const stop = onApiWrite(listener);
    await api.get("/pets");
    expect(listener).not.toHaveBeenCalled();
    await api.post("/bookmarks", { pet_id: 1 });
    expect(listener).toHaveBeenCalledOnce();

    stop();
    await api.post("/bookmarks", { pet_id: 2 });
    expect(listener).toHaveBeenCalledOnce();
  });
});
