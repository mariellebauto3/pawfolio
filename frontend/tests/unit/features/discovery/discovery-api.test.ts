import { describe, expect, it } from "vitest";
import {
  browseHomes,
  browsePets,
  getHomeProfileDetail,
  getPetProfile,
  getSimilarPets,
  search,
} from "@/features/discovery/api/discovery";
import { NO_FILTERS } from "@/features/discovery/schemas/browse-filters";
import { type Transport, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The discovery calls against the mock API, which answers in the shapes of docs/api/discovery.md.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body`. */
function answering(body: unknown) {
  const transport: Transport = async () => ({ status: 200, body, retryAfter: null });
  return createApiClient(transport);
}

const names = (rows: { name?: string; full_name?: string }[]) => rows.map((row) => row.name ?? row.full_name);

describe("browsing pets (DS-01)", () => {
  it("lists only pets that are looking for a home, best match first for a human", async () => {
    const page = await browsePets(as("human"), NO_FILTERS);
    expect(names(page.data)).toEqual(["Tofu", "Biscuit", "Pepper"]);
    expect(page.data.map((pet) => pet.match_score)).toEqual([91, 72, 64]);
    expect(page.data.every((pet) => pet.status === "looking_for_a_home")).toBe(true);
  });

  it("narrows by the filters and the search", async () => {
    const pick = (picked: Record<string, string[]>, search = "") => browsePets(as("human"), { ...NO_FILTERS, search, picked });
    expect(names((await pick({ species: ["cat"] })).data)).toEqual(["Tofu"]);
    expect(names((await pick({ temperament: ["Calm"] })).data)).toEqual(["Tofu", "Biscuit"]);
    expect(names((await pick({ age: ["puppy_kitten"] })).data)).toEqual(["Pepper"]);
    expect(names((await pick({ good_with: ["kids", "dogs"] })).data)).toEqual(["Pepper"]);
    expect(names((await pick({}, "makati")).data)).toEqual(["Biscuit"]);
    expect((await pick({ species: ["other"] })).meta.total).toBe(0);
  });

  it("refuses an answer that isn't a page", async () => {
    await expect(browsePets(answering({ data: "nope" }), NO_FILTERS)).rejects.toMatchObject({ kind: "server" });
    await expect(browseHomes(answering({ data: [], meta: {} }), NO_FILTERS)).rejects.toMatchObject({ kind: "server" });
  });

  it("leaves out rows that don't match the contract", async () => {
    const meta = { total: 2, current_page: 1, last_page: 1 };
    const page = await browsePets(answering({ data: [{ id: 1 }, null], meta }), NO_FILTERS);
    expect(page.data).toEqual([]);
  });
});

describe("browsing homes (DS-02)", () => {
  it("lists only homes that are Open to Adopt with the quiz finished", async () => {
    const page = await browseHomes(as("pet"), NO_FILTERS);
    expect(names(page.data)).toEqual(["Ana Santos", "Paolo Garcia"]);
    expect(page.data.map((home) => home.match_score)).toEqual([86, 78]);
  });

  it("narrows by the household", async () => {
    const pick = (picked: Record<string, string[]>) => browseHomes(as("pet"), { ...NO_FILTERS, picked });
    expect(names((await pick({ home_type: ["house"] })).data)).toEqual(["Paolo Garcia"]);
    expect(names((await pick({ other_pets: ["none"] })).data)).toEqual(["Paolo Garcia"]);
    expect(names((await pick({ other_pets: ["cats"] })).data)).toEqual(["Ana Santos"]);
    expect((await pick({ kids: ["yes"] })).meta.total).toBe(0);
    expect((await pick({ kids: ["no"] })).meta.total).toBe(2);
  });

  it("never carries an address or a phone number (SEC-PRIV-03)", async () => {
    const page = await browseHomes(as("pet"), NO_FILTERS);
    for (const home of page.data) {
      expect(home).not.toHaveProperty("street_address");
      expect(home).not.toHaveProperty("contact_number");
    }
  });
});

describe("profiles (DS-05, DS-07, DS-08)", () => {
  it("gives a human the resume with their match", async () => {
    const pet = await getPetProfile(as("human"), 6);
    expect(pet).toMatchObject({ name: "Tofu", match: { passed_dealbreakers: true, score: 91, failed_dealbreakers: [] } });
    expect(pet.match?.reasons.length).toBeGreaterThan(0);
  });

  it("gives an adopted pet's profile with who hired it, and no contact details", async () => {
    const luna = await getPetProfile(as("pet"), 4);
    expect(luna).toMatchObject({ status: "adopted_hired", hired_by: { full_name: "Ana Santos", home_profile_id: 1 } });
    expect(luna.match).toBeUndefined();
    expect(luna).not.toHaveProperty("caretaker_contact_number");
  });

  it("answers not found for a Draft and for a home that isn't open", async () => {
    await expect(getPetProfile(as("human"), 2)).rejects.toMatchObject({ kind: "not_found" });
    await expect(getHomeProfileDetail(as("pet"), 2)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("gives a pet the Home Profile with its match", async () => {
    await expect(getHomeProfileDetail(as("pet"), 3)).resolves.toMatchObject({ full_name: "Paolo Garcia", match: { score: 78 } });
  });

  it("reads a failed dealbreaker and drops reasons it can't use", async () => {
    const pet = await getPetProfile(as("human"), 6);
    const match = { passed_dealbreakers: false, failed_dealbreakers: ["same_province", "made_up"], score: 0, reasons: ["ok", 4] };
    const read = await getPetProfile(answering({ data: { ...pet, match } }), 6);
    expect(read.match).toEqual({ passed_dealbreakers: false, failed_dealbreakers: ["same_province"], score: 0, reasons: ["ok"] });
  });

  it("refuses a profile that doesn't match the contract", async () => {
    await expect(getPetProfile(answering({ data: { id: 6, name: "Tofu", status: "on_sale" } }), 6)).rejects.toMatchObject({ kind: "server" });
    await expect(getHomeProfileDetail(answering({ data: { id: 1 } }), 1)).rejects.toMatchObject({ kind: "server" });
  });

  it("suggests other pets of the species, never the pet itself", async () => {
    const similar = await getSimilarPets(as("human"), { id: 5, species: "dog" });
    expect(names(similar)).toEqual(["Biscuit"]);
  });
});

describe("search (DS-03, DS-04)", () => {
  it("gives an overview of pets, homes and posts with how many there are of each", async () => {
    const results = await search(as("human"), "quezon");
    expect(results.query).toBe("quezon");
    expect(results.totals).toEqual({ pets: 1, homes: 1, posts: 1 });
    if (results.view.kind !== "all") throw new Error("expected the overview");
    expect(names(results.view.pets)).toEqual(["Tofu"]);
    expect(names(results.view.homes)).toEqual(["Ana Santos"]);
    expect(results.view.posts.map((post) => post.type)).toEqual(["adoption_story"]);
  });

  it("pages through one kind, still with the totals of all three", async () => {
    const results = await search(as("pet"), "a", "homes");
    expect(results.totals.homes).toBe(2);
    expect(results.totals.pets).toBeGreaterThan(0);
    if (results.view.kind !== "homes") throw new Error("expected the homes tab");
    expect(names(results.view.page.data)).toEqual(["Ana Santos", "Paolo Garcia"]);
    expect(results.view.page.meta).toMatchObject({ current_page: 1, last_page: 1, total: 2 });
  });

  it("asks the API for the kind by its own name, and for a page only past the first", async () => {
    const calls: unknown[] = [];
    const client = createApiClient(async (request) => {
      calls.push(request.query);
      return { status: 200, body: { data: [], meta: { total: 0, current_page: 1, last_page: 1 } }, retryAfter: null };
    });
    await search(client, "aspin", "homes", 3);
    await search(client, "aspin", "posts");
    expect(calls).toEqual([
      { q: "aspin", type: "home_profiles", page: 3, per_page: 20 },
      { q: "aspin", type: "posts", page: undefined, per_page: 20 },
    ]);
  });

  it("comes back empty, not broken, when nothing matches", async () => {
    await expect(search(as("human"), "zebra")).resolves.toEqual({
      query: "zebra",
      totals: { pets: 0, homes: 0, posts: 0 },
      view: { kind: "all", pets: [], homes: [], posts: [] },
    });
  });

  it("never returns Drafts or adopted pets", async () => {
    const results = await search(as("human"), "puspin", "pets");
    expect(results.totals.pets).toBe(0);
    expect(results.view).toMatchObject({ kind: "pets", page: { data: [] } });
  });

  it("counts a missing total as none and refuses an answer that isn't a search", async () => {
    await expect(search(answering({ data: { query: "a", pets: [], home_profiles: [], posts: [] } }), "a")).resolves.toMatchObject({
      totals: { pets: 0, homes: 0, posts: 0 },
    });
    await expect(search(answering({ data: "nope" }), "a")).rejects.toMatchObject({ kind: "server" });
    await expect(search(answering({ data: [] }), "a", "pets")).rejects.toMatchObject({ kind: "server" });
  });
});
