import { describe, expect, it, vi } from "vitest";
import { type Transport, createApiClient } from "@/lib/api/core";
import { fetchSession } from "@/lib/auth/session";

const answer = (status: number, body: unknown = null): Transport => async () => ({ status, body, retryAfter: null });

describe("fetchSession", () => {
  const account = { id: 1, role: "pet", status: "active" };

  it("returns the account", async () => {
    await expect(fetchSession(createApiClient(answer(200, { data: account })))).resolves.toEqual(account);
  });

  it("returns null when signed out, without triggering the redirect listener", async () => {
    const onError = vi.fn();
    await expect(fetchSession(createApiClient(answer(401), { onError }))).resolves.toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("throws when the session can't be checked", async () => {
    await expect(fetchSession(createApiClient(answer(503)))).rejects.toMatchObject({ kind: "server" });
  });
});

describe("fetchSession: /auth/me shape", () => {
  it.each([
    [{}],
    [{ data: null }],
    [{ data: { id: 1, role: "owner", status: "active" } }],
    [{ data: { id: 1, role: "pet", status: "resubmitted" } }],
    [{ data: { id: "1", role: "pet", status: "active" } }],
  ])("treats %j as 'couldn't check'", async (body) => {
    await expect(fetchSession(createApiClient(answer(200, body)))).rejects.toMatchObject({ kind: "server" });
  });
});
