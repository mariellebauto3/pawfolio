import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "@/lib/api/core";
import { MOCK_PERSONAS } from "@/lib/api/mock/personas";
import { dispatch, matchPath, paginate, route } from "@/lib/api/mock/router";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";
import { fetchSession } from "@/lib/auth/session";
import type { Account } from "@/types/account";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { ApiResource, Paginated } from "@/types/api";

function mockClient(persona: string | null) {
  let current = persona;
  const writePersona = vi.fn((next: string) => {
    current = next;
  });
  const transport = createMockTransport({
    readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? current : null),
    writePersona,
    latencyMs: 0,
  });
  return { client: createApiClient(transport), writePersona };
}

describe("mock router", () => {
  it("matches named params by whole segment", () => {
    expect(matchPath("/pets/:petId", "/pets/3")).toEqual({ petId: "3" });
    expect(matchPath("/pets/:petId", "/pets/3/photos")).toBeNull();
    expect(matchPath("/pets", "/home-profiles")).toBeNull();
  });

  it("applies the same gates as the API middleware", () => {
    const routes = [route("GET", "/feed", () => ({ status: 200 })), route("GET", "/admin/x", () => ({ status: 200 }), "admin")];
    const active = MOCK_PERSONAS.pet as Account;
    expect(dispatch(routes, { method: "GET", path: "/feed" }, null).status).toBe(401);
    expect(dispatch(routes, { method: "GET", path: "/feed" }, MOCK_PERSONAS["pet-suspended"]).body).toMatchObject({
      code: "account_not_active",
    });
    expect(dispatch(routes, { method: "GET", path: "/admin/x" }, active).status).toBe(403);
    expect(dispatch(routes, { method: "GET", path: "/admin/x" }, MOCK_PERSONAS.admin).status).toBe(200);
    expect(dispatch(routes, { method: "GET", path: "/nope" }, active).status).toBe(404);
  });

  it("paginates like Laravel, capped at 50 per page", () => {
    const items = Array.from({ length: 120 }, (_, i) => i);
    const page = paginate(items, { page: 2, per_page: 500 }, "/api/v1/items");
    expect(page.meta).toMatchObject({ current_page: 2, last_page: 3, per_page: 50, total: 120, from: 51, to: 100 });
    expect(page.links.next).toBe("/api/v1/items?page=3");
    expect(paginate([], {}, "/x").meta).toMatchObject({ current_page: 1, last_page: 1, from: null, to: null });
  });
});

describe("mock transport", () => {
  it("answers /auth/me for the persona in the cookie, whatever its status", async () => {
    await expect(fetchSession(mockClient("human").client)).resolves.toMatchObject({ display_name: "Ana Santos" });
    await expect(fetchSession(mockClient("pet-pending").client)).resolves.toMatchObject({
      status: "pending_verification",
    });
    await expect(fetchSession(mockClient("signed-out").client)).resolves.toBeNull();
    // No cookie yet: the default persona.
    await expect(fetchSession(mockClient(null).client)).resolves.toMatchObject({ role: "pet" });
  });

  it("signs in by persona email and remembers the persona", async () => {
    const { client, writePersona } = mockClient("signed-out");
    await expect(client.post("/auth/sign-in", { email: "admin@example.com", password: "wrong" })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { email: expect.any(String) },
    });
    const { data } = await client.post<ApiResource<Account>>("/auth/sign-in", {
      email: "Admin@Example.com",
      password: "password",
    });
    expect(data.role).toBe("admin");
    expect(writePersona).toHaveBeenCalledWith("admin");
    await expect(fetchSession(client)).resolves.toMatchObject({ role: "admin" });
  });

  it("shows only the requests the persona is part of", async () => {
    const { client } = mockClient("human");
    const page = await client.get<Paginated<AdoptionRequest>>("/adoption-requests");
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data.every((request) => request.home_profile.full_name === "Ana Santos")).toBe(true);
    await expect(client.get("/adoption-requests/2")).rejects.toMatchObject({ kind: "not_found" });
  });

  it("returns rule conflicts and field errors for new requests", async () => {
    const { client } = mockClient("pet");
    await expect(client.post("/adoption-requests", { home_profile_id: 3, cover_letter: "Too short" })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { cover_letter: expect.any(String) },
    });
    await expect(
      client.post("/adoption-requests", { home_profile_id: 3, cover_letter: "x".repeat(60) }),
    ).rejects.toMatchObject({ kind: "conflict", code: "request_already_open" });
  });

  it("never passes 5xx server text through", async () => {
    const { client } = mockClient("pet");
    const error = await client.get("/mock/server-error").catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "server" });
    expect((error as Error).message).not.toContain("SQLSTATE");
  });

  it("does not let callers mutate fixtures through responses", async () => {
    const { client } = mockClient("pet");
    const first = await client.get<ApiResource<{ name: string }>>("/pets/1");
    first.data.name = "Changed";
    const second = await client.get<ApiResource<{ name: string }>>("/pets/1");
    expect(second.data.name).toBe("Mochi");
  });
});

describe("mock router: malformed paths", () => {
  it("answers 404 for a malformed escape instead of crashing", () => {
    const routes = [route("GET", "/pets/:petId", () => ({ status: 200 }), "public")];
    expect(dispatch(routes, { method: "GET", path: "/pets/%E0%A4%A" }, null).status).toBe(404);
  });
});

describe("mock transport: unsafe paths", () => {
  it("refuses path traversal like the live client", async () => {
    const client = createApiClient(createMockTransport({ readCookie: () => "pet", latencyMs: 0 }));
    await expect(client.get("/pets/../adoption-requests")).rejects.toThrow(/Unsafe API path/);
  });
});
