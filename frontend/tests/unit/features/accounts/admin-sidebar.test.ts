import { describe, expect, it } from "vitest";
import { getAdminSidebarCounts, markAdminSectionSeen } from "@/features/accounts/api/admin-sidebar";
import { type Transport, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The admin sidebar's counts and the call that clears one (GN-01), against the mock API and against answers that
// don't match the contract.

function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

function answering(body: unknown, status = 200) {
  const calls: { method: string; path: string }[] = [];
  const transport: Transport = async ({ method, path }) => {
    calls.push({ method, path });
    return { status, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

describe("the admin sidebar's counts", () => {
  it("reads a count for each of the three sections", async () => {
    const counts = await getAdminSidebarCounts(as("admin"));
    expect(Object.keys(counts).sort()).toEqual(["reports", "requests", "verification"]);
    for (const count of Object.values(counts)) expect(Number.isInteger(count) && (count ?? -1) >= 0).toBe(true);
    expect(counts.verification).toBe(23);
  });

  it("is for Active admins only", async () => {
    await expect(getAdminSidebarCounts(as("signed-out"))).rejects.toMatchObject({ kind: "unauthenticated" });
    await expect(getAdminSidebarCounts(as("pet"))).rejects.toMatchObject({ kind: "forbidden" });
    await expect(markAdminSectionSeen(as("human"), "reports")).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("leaves out a count that isn't a whole number, and refuses an answer with no counts", async () => {
    const { client } = answering({ data: { counts: { verification: 2, reports: "3", requests: -1, accounts: 9 } } });
    await expect(getAdminSidebarCounts(client)).resolves.toEqual({ verification: 2 });
    await expect(getAdminSidebarCounts(answering({ data: {} }).client)).rejects.toMatchObject({ kind: "server" });
  });

  it("tells the API which section was opened, and nothing else", async () => {
    const { client, calls } = answering(null, 204);
    await markAdminSectionSeen(client, "verification");
    await markAdminSectionSeen(client, "requests");
    expect(calls).toEqual([
      { method: "POST", path: "/admin/sidebar/verification/seen" },
      { method: "POST", path: "/admin/sidebar/requests/seen" },
    ]);
    await expect(markAdminSectionSeen(as("admin"), "reports")).resolves.toBeUndefined();
  });
});
