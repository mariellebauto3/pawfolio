import { describe, expect, it, vi } from "vitest";
import { type Transport, apiPath, assertSafePath, buildApiUrl, createApiClient } from "@/lib/api/core";
import { ApiError } from "@/lib/api/errors";

const answer = (status: number, body: unknown = null): Transport => async () => ({ status, body, retryAfter: null });

describe("buildApiUrl", () => {
  it("prefixes /api/v1 and encodes the query the way Laravel reads it", () => {
    const url = buildApiUrl("http://localhost:8000", "/pets", {
      species: "dog",
      page: 2,
      open_to_adopt: true,
      has_photos: false,
      sizes: ["small", "medium"],
      city: null,
      breed: undefined,
      q: "shih tzu & co",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("http://localhost:8000/api/v1/pets");
    expect(parsed.searchParams.get("species")).toBe("dog");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("open_to_adopt")).toBe("1");
    expect(parsed.searchParams.get("has_photos")).toBe("0");
    expect(parsed.searchParams.getAll("sizes[]")).toEqual(["small", "medium"]);
    expect(parsed.searchParams.has("city")).toBe(false);
    expect(parsed.searchParams.has("breed")).toBe(false);
    expect(parsed.searchParams.get("q")).toBe("shih tzu & co");
  });

  it("rejects paths that could point at another host", () => {
    expect(() => buildApiUrl("http://localhost:8000", "pets")).toThrow();
    expect(() => buildApiUrl("http://localhost:8000", "//evil.example/x")).toThrow();
  });
});

describe("createApiClient", () => {
  it("returns the body of 2xx responses", async () => {
    const client = createApiClient(answer(200, { data: { id: 1 } }));
    await expect(client.get("/pets/1")).resolves.toEqual({ data: { id: 1 } });
  });

  it("reports errors to onError unless skipAuthRedirect is set", async () => {
    const onError = vi.fn();
    const client = createApiClient(answer(401), { onError });

    await expect(client.get("/me")).rejects.toBeInstanceOf(ApiError);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: "unauthenticated" }));

    onError.mockClear();
    await expect(client.get("/me", { skipAuthRedirect: true })).rejects.toBeInstanceOf(ApiError);
    expect(onError).not.toHaveBeenCalled();
  });

  it("turns a failed fetch into a network ApiError", async () => {
    const onError = vi.fn();
    const client = createApiClient(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      { onError },
    );
    await expect(client.get("/pets")).rejects.toMatchObject({ kind: "network", status: 0 });
    expect(onError).toHaveBeenCalledOnce();
  });

  it("lets a cancelled request reject with the AbortError itself", async () => {
    const onError = vi.fn();
    const abort = new DOMException("Aborted", "AbortError");
    const client = createApiClient(
      async () => {
        throw abort;
      },
      { onError },
    );
    await expect(client.get("/pets")).rejects.toBe(abort);
    expect(onError).not.toHaveBeenCalled();
  });

  it("passes method, path, query and body to the transport", async () => {
    const transport = vi.fn(answer(200));
    const client = createApiClient(transport);
    await client.patch("/me", { headline: "Hi" }, { query: { draft: true } });
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ method: "PATCH", path: "/me", query: { draft: true }, body: { headline: "Hi" } }),
    );
  });
});

describe("client-side path traversal (SEC-FE-08)", () => {
  it.each([
    "/adoption-requests/../admin/accounts/5/suspend",
    "/adoption-requests/./12",
    "/pets/%2e%2e/admin",
    "/pets/1\\..\\..\\admin",
    "/pets/1?role=admin",
    "/pets/1#x",
    "pets",
    "//evil.example/x",
  ])("refuses %s before anything is sent", async (path) => {
    expect(() => assertSafePath(path)).toThrow(/Unsafe API path/);

    const transport = vi.fn(answer(200));
    const onError = vi.fn();
    const client = createApiClient(transport, { onError });
    await expect(client.post(path, {})).rejects.toThrow(/Unsafe API path/);
    expect(transport).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("apiPath encodes values so they stay inside one segment", () => {
    expect(apiPath`/adoption-requests/${12}/withdraw`).toBe("/adoption-requests/12/withdraw");
    expect(apiPath`/pets/${"a/b?c#d"}`).toBe("/pets/a%2Fb%3Fc%23d");
    expect(() => assertSafePath(apiPath`/pets/${"a/b?c#d"}`)).not.toThrow();
    // ".." survives encoding, so the guard still has to catch it.
    expect(() => assertSafePath(apiPath`/pets/${".."}/admin`)).toThrow();
  });

});

describe("cancellation and bugs are not reported as network errors", () => {
  it("rethrows the caller's own abort reason", async () => {
    const controller = new AbortController();
    const reason = new Error("left the page");
    const client = createApiClient(async () => {
      controller.abort(reason);
      throw reason;
    });
    await expect(client.get("/pets", { signal: controller.signal })).rejects.toBe(reason);
  });

  it("rethrows a timeout from AbortSignal.timeout", async () => {
    const signal = AbortSignal.timeout(1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const client = createApiClient(async () => {
      throw signal.reason;
    });
    await expect(client.get("/pets", { signal })).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("lets programming errors surface instead of hiding them as network errors", async () => {
    const bug = new RangeError("bug in a transport");
    const client = createApiClient(async () => {
      throw bug;
    });
    await expect(client.get("/pets")).rejects.toBe(bug);
  });
});
