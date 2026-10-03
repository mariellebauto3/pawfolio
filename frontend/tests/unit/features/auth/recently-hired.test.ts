import { describe, expect, it } from "vitest";
import { fetchRecentlyHired } from "@/features/auth/api/recently-hired";
import { type ApiClient, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

function mockClient(persona: string) {
  const transport = createMockTransport({
    readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null),
    latencyMs: 0,
  });
  return createApiClient(transport);
}

describe("fetchRecentlyHired (AU-01, docs/api/discovery.md)", () => {
  it("is public: signed-out visitors and blocked accounts both get the strip", async () => {
    for (const persona of ["signed-out", "pet-suspended"]) {
      const pets = await fetchRecentlyHired(mockClient(persona));
      expect(pets.length).toBeGreaterThan(0);
      expect(pets.length).toBeLessThanOrEqual(8);
    }
  });

  it("sends only name, photo and Hired date, newest first", async () => {
    const pets = await fetchRecentlyHired(mockClient("signed-out"));
    for (const pet of pets) expect(Object.keys(pet).sort()).toEqual(["hired_at", "name", "photo_url"]);
    const dates = pets.map((pet) => Date.parse(pet.hired_at));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("treats a response without a list as empty", async () => {
    const client = { get: async () => ({ data: null }) } as unknown as ApiClient;
    await expect(fetchRecentlyHired(client)).resolves.toEqual([]);
  });
});
