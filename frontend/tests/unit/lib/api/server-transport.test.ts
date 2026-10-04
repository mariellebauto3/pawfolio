import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "@/lib/api/core";
import { createServerTransport } from "@/lib/api/server-transport";

describe("server transport", () => {
  function setup(cookie: string | null) {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(JSON.stringify({ data: { id: 1 } }), { headers: { "Content-Type": "application/json" } }),
    );
    const transport = createServerTransport({ apiUrl: "http://localhost:8000", cookie, origin: "http://localhost:3000", fetch });
    return { client: createApiClient(transport), fetch };
  }

  it("forwards the visitor's cookies and our origin so Sanctum sees a first-party call", async () => {
    const { client, fetch } = setup("pawfolio-session=abc; XSRF-TOKEN=tok%3D");
    await client.get("/auth/me");

    const [url, init] = fetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(String(url)).toBe("http://localhost:8000/api/v1/auth/me");
    expect(headers.get("Cookie")).toBe("pawfolio-session=abc; XSRF-TOKEN=tok%3D");
    expect(headers.get("Origin")).toBe("http://localhost:3000");
    expect(headers.get("Referer")).toBe("http://localhost:3000/");
    expect(headers.get("X-XSRF-TOKEN")).toBeNull();
    expect(init?.cache).toBe("no-store");
  });

  it("echoes the XSRF token on writes", async () => {
    const { client, fetch } = setup("pawfolio-session=abc; XSRF-TOKEN=tok%3D");
    await client.post("/auth/sign-out");
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("X-XSRF-TOKEN")).toBe("tok=");
  });

  it("works without cookies", async () => {
    const { client, fetch } = setup(null);
    await client.get("/auth/me");
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Cookie")).toBeNull();
  });

  // A fetch that never answers, but stops when its signal says so, like a real one.
  const hangingFetch = () =>
    vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );

  it("gives up on an API that never answers, as a network error the page can show", async () => {
    const fetch = hangingFetch();
    const transport = createServerTransport({ apiUrl: "http://localhost:8000", cookie: null, origin: "http://localhost:3000", fetch, timeoutMs: 20 });

    await expect(createApiClient(transport).get("/me/pet")).rejects.toMatchObject({ name: "ApiError", kind: "network", status: 0 });
  });

  it("passes the caller's own cancellation on as it is", async () => {
    const fetch = hangingFetch();
    const transport = createServerTransport({ apiUrl: "http://localhost:8000", cookie: null, origin: "http://localhost:3000", fetch, timeoutMs: 5_000 });
    const controller = new AbortController();
    const call = createApiClient(transport).get("/me/pet", { signal: controller.signal });
    controller.abort();

    await expect(call).rejects.toMatchObject({ name: "AbortError" });
  });
});
