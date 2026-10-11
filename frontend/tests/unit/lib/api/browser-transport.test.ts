import { describe, expect, it, vi } from "vitest";
import { createBrowserTransport } from "@/lib/api/browser-transport";
import { createApiClient } from "@/lib/api/core";
import { ApiError } from "@/lib/api/errors";

const API_URL = "http://localhost:8000";

type Call = { url: string; init: RequestInit };

/** A fake Laravel: records calls, sets XSRF-TOKEN on /sanctum/csrf-cookie, answers with the queued responses. */
function setup({ responses = [] as Response[], token = null as string | null } = {}) {
  const calls: Call[] = [];
  let cookie = token;
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/sanctum/csrf-cookie")) {
      cookie = "eyJpdiI6IjEyMyJ9%3D";
      return new Response(null, { status: 204 });
    }
    return responses.shift() ?? json(200, { data: null });
  });
  const readCookie = (name: string) => (name === "XSRF-TOKEN" && cookie ? decodeURIComponent(cookie) : null);
  const client = createApiClient(createBrowserTransport({ apiUrl: API_URL, fetch, readCookie }));
  return { client, calls };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);

describe("browser transport", () => {
  it("sends cookies and asks Laravel for JSON", async () => {
    const { client, calls } = setup({ responses: [json(200, { data: { id: 1 } })] });

    await expect(client.get("/pets/1")).resolves.toEqual({ data: { id: 1 } });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API_URL}/api/v1/pets/1`);
    expect(calls[0].init.credentials).toBe("include");
    expect(header(calls[0], "Accept")).toBe("application/json");
    expect(header(calls[0], "X-Requested-With")).toBe("XMLHttpRequest");
  });

  it("does not fetch a CSRF cookie for reads", async () => {
    const { client, calls } = setup();
    await client.get("/pets");
    expect(calls.map((c) => c.url)).toEqual([`${API_URL}/api/v1/pets`]);
    expect(header(calls[0], "X-XSRF-TOKEN")).toBeNull();
  });

  it("fetches /sanctum/csrf-cookie before the first write and sends the decoded token", async () => {
    const { client, calls } = setup({ responses: [json(201, { data: { id: 9 } })] });

    await client.post("/adoption-requests", { home_profile_id: 1, cover_letter: "Hi" });

    expect(calls.map((c) => c.url)).toEqual([`${API_URL}/sanctum/csrf-cookie`, `${API_URL}/api/v1/adoption-requests`]);
    expect(calls[0].init.credentials).toBe("include");
    const write = calls[1];
    expect(write.init.method).toBe("POST");
    expect(header(write, "X-XSRF-TOKEN")).toBe("eyJpdiI6IjEyMyJ9=");
    expect(header(write, "Content-Type")).toBe("application/json");
    expect(write.init.body).toBe(JSON.stringify({ home_profile_id: 1, cover_letter: "Hi" }));
  });

  it("reuses an existing CSRF cookie", async () => {
    const { client, calls } = setup({ token: "abc" });
    await client.patch("/me", { headline: "Hi" });
    await client.delete("/bookmarks/3");
    expect(calls.map((c) => c.url)).toEqual([`${API_URL}/api/v1/me`, `${API_URL}/api/v1/bookmarks/3`]);
    expect(header(calls[1], "X-XSRF-TOKEN")).toBe("abc");
  });

  it("shares one CSRF request between writes that start together", async () => {
    const { client, calls } = setup();
    await Promise.all([client.post("/a"), client.post("/b")]);
    expect(calls.filter((c) => c.url.endsWith("/sanctum/csrf-cookie"))).toHaveLength(1);
  });

  it("refreshes the CSRF cookie and retries once on 419", async () => {
    const { client, calls } = setup({
      token: "stale",
      responses: [json(419, { message: "CSRF token mismatch." }), json(200, { data: "ok" })],
    });

    await expect(client.post("/requests/1/withdraw")).resolves.toEqual({ data: "ok" });
    expect(calls.map((c) => c.url)).toEqual([
      `${API_URL}/api/v1/requests/1/withdraw`,
      `${API_URL}/sanctum/csrf-cookie`,
      `${API_URL}/api/v1/requests/1/withdraw`,
    ]);
  });

  it("gives up after one retry on 419", async () => {
    const { client } = setup({
      token: "stale",
      responses: [json(419, {}), json(419, {})],
    });
    await expect(client.post("/x")).rejects.toMatchObject({ kind: "session_expired", status: 419 });
  });

  it("sends FormData without a JSON content type", async () => {
    const { client, calls } = setup({ token: "abc" });
    const form = new FormData();
    form.append("photo", new Blob(["x"], { type: "image/png" }), "photo.png");
    await client.post("/pets/1/photos", form);
    expect(calls[0].init.body).toBe(form);
    expect(header(calls[0], "Content-Type")).toBeNull();
  });

  it("turns error responses into ApiError", async () => {
    const { client } = setup({
      token: "abc",
      responses: [json(422, { message: "Invalid.", errors: { cover_letter: ["Too short."] } })],
    });
    const error = await client.post("/adoption-requests", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "validation", fieldErrors: { cover_letter: "Too short." } });
  });

  it("passes Retry-After through on 429", async () => {
    const { client } = setup({ token: "abc", responses: [json(429, { message: "Slow down." }, { "Retry-After": "60" })] });
    await expect(client.post("/auth/sign-in", {})).rejects.toMatchObject({ kind: "rate_limited", retryAfterSeconds: 60 });
  });

  it("returns null for 204 No Content", async () => {
    const { client } = setup({ token: "abc", responses: [new Response(null, { status: 204 })] });
    await expect(client.post("/auth/sign-out")).resolves.toBeNull();
  });

  it("reports a failed CSRF request as an ApiError", async () => {
    const fetch = vi.fn(async () => json(500, { message: "boom" }));
    const client = createApiClient(createBrowserTransport({ apiUrl: API_URL, fetch, readCookie: () => null }));
    await expect(client.post("/x")).rejects.toMatchObject({ kind: "server", status: 500 });
  });
});

describe("browser transport: files", () => {
  const png = () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "Content-Type": "image/png" } });

  it("hands a file over as a blob, read with the session cookie", async () => {
    const { client, calls } = setup({ responses: [png()] });

    const blob = await client.getFile("/admin/verifications/4/documents/41", { accept: ["image/png"] });

    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(4);
    expect(calls[0].url).toBe(`${API_URL}/api/v1/admin/verifications/4/documents/41`);
    expect(calls[0].init.credentials).toBe("include");
  });

  it("still reads an error as JSON when a file was asked for", async () => {
    const { client } = setup({ responses: [json(403, { message: "This page is for admins only." })] });
    await expect(client.getFile("/admin/verifications/4/documents/41", { accept: ["image/png"] })).rejects.toMatchObject({
      kind: "forbidden",
      message: "This page is for admins only.",
    });
  });
});
