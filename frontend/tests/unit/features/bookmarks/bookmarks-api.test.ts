import { describe, expect, it } from "vitest";
import { getSavedHomes, getSavedPets, removeBookmark, saveBookmark } from "@/features/bookmarks/api/bookmarks";
import { type ApiClient, type Transport, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The bookmark calls against the mock API, which answers in the shapes of docs/api/bookmarks-and-invites.md. The
// mock keeps what is saved in memory for the whole file, so the tests that change it come last.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body`, and remembers what it was asked. */
function answering(body: unknown) {
  const calls: { method: string; path: string; body?: unknown; query?: unknown }[] = [];
  const transport: Transport = async ({ method, path, body: sent, query }) => {
    calls.push({ method, path, body: sent, query });
    return { status: 200, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

const savedPetNames = async (client: ApiClient) => (await getSavedPets(client)).data.map((row) => row.pet.name);
const savedHomeNames = async (client: ApiClient) => (await getSavedHomes(client)).data.map((row) => row.home_profile.full_name);

describe("the Bookmarks list (BM-01, BM-02)", () => {
  it("gives a human the pets they saved, newest save first, with their match", async () => {
    const page = await getSavedPets(as("human"));
    expect(page.data.map((row) => row.pet.name)).toEqual(["Tofu", "Luna", "Biscuit"]);
    // Luna was adopted after she was saved: she stays, without a score.
    expect(page.data.map((row) => row.pet.match_score)).toEqual([91, undefined, 72]);
    expect(page.data.map((row) => row.pet.status)).toEqual(["looking_for_a_home", "adopted_hired", "looking_for_a_home"]);
    expect(page.meta.total).toBe(3);
  });

  it("gives a pet the homes it saved", async () => {
    const page = await getSavedHomes(as("pet"));
    expect(page.data.map((row) => row.home_profile.full_name)).toEqual(["Ana Santos", "Paolo Garcia"]);
    expect(page.data.map((row) => row.home_profile.match_score)).toEqual([86, 78]);
  });

  it("asks for a page of twelve, and for page 1 without naming it", async () => {
    const meta = { total: 0, current_page: 1, last_page: 1 };
    const { client, calls } = answering({ data: [], meta });
    await getSavedPets(client);
    await getSavedHomes(client, 3);
    expect(calls.map((call) => call.query)).toEqual([{ page: undefined, per_page: 12 }, { page: 3, per_page: 12 }]);
  });

  it("refuses an answer that isn't a page, and leaves out rows that don't match the contract", async () => {
    await expect(getSavedPets(answering({ data: "nope" }).client)).rejects.toMatchObject({ kind: "server" });

    const meta = { total: 3, current_page: 1, last_page: 1 };
    const rows = [{ id: 1, pet: { id: 9 } }, { pet: null }, null];
    expect((await getSavedPets(answering({ data: rows, meta }).client)).data).toEqual([]);
    // A human's row has no home on it, so it is no row of a pet's list.
    const humans = (await as("human").get<{ data: unknown[] }>("/bookmarks")).data;
    expect((await getSavedHomes(answering({ data: humans, meta }).client)).data).toEqual([]);
  });

  it("is closed to admins and to accounts that aren't active", async () => {
    await expect(getSavedPets(as("admin"))).rejects.toMatchObject({ kind: "forbidden" });
    await expect(getSavedPets(as("pet-suspended"))).rejects.toMatchObject({ kind: "account_not_active" });
    await expect(getSavedPets(as("signed-out"))).rejects.toMatchObject({ kind: "unauthenticated" });
  });
});

describe("saving and removing (BM-03)", () => {
  it("sends the pet for a human and the home for a pet, and the profile's own path to remove", async () => {
    const { client, calls } = answering({ data: {} });
    await saveBookmark(client, { kind: "pet", id: 5 });
    await saveBookmark(client, { kind: "home", id: 3 });
    await removeBookmark(client, { kind: "pet", id: 5 });
    await removeBookmark(client, { kind: "home", id: 3 });

    expect(calls.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: "POST", path: "/bookmarks", body: { pet_id: 5 } },
      { method: "POST", path: "/bookmarks", body: { home_profile_id: 3 } },
      { method: "DELETE", path: "/bookmarks/pets/5", body: undefined },
      { method: "DELETE", path: "/bookmarks/home-profiles/3", body: undefined },
    ]);
  });

  it("refuses what the role may not save", async () => {
    // A human saves pets, a pet saves homes: the other kind is a validation error, as from the API.
    await expect(saveBookmark(as("human"), { kind: "home", id: 3 })).rejects.toMatchObject({ kind: "validation" });
    await expect(saveBookmark(as("pet"), { kind: "pet", id: 3 })).rejects.toMatchObject({ kind: "validation" });
    // A Draft answers like a pet that doesn't exist, and so does a home that isn't Open to Adopt.
    await expect(saveBookmark(as("human"), { kind: "pet", id: 2 })).rejects.toMatchObject({ kind: "not_found" });
    await expect(saveBookmark(as("pet"), { kind: "home", id: 2 })).rejects.toMatchObject({ kind: "not_found" });
    await expect(saveBookmark(as("human"), { kind: "pet", id: 999 })).rejects.toMatchObject({ kind: "not_found" });
    // An adopted pet's profile is public, but it has no Bookmark (DS-08).
    await expect(saveBookmark(as("human"), { kind: "pet", id: 4 })).rejects.toMatchObject({ kind: "conflict", code: "pet_already_adopted" });
  });

  it("saves once, however often it is pressed, and removes the same way", async () => {
    const human = as("human");
    await saveBookmark(human, { kind: "pet", id: 5 });
    await saveBookmark(human, { kind: "pet", id: 5 });
    expect(await savedPetNames(human)).toEqual(["Pepper", "Tofu", "Luna", "Biscuit"]);

    await removeBookmark(human, { kind: "pet", id: 5 });
    await removeBookmark(human, { kind: "pet", id: 5 });
    expect(await savedPetNames(human)).toEqual(["Tofu", "Luna", "Biscuit"]);
  });

  it("removes only the account's own bookmark", async () => {
    const pet = as("pet");
    // Mochi (a pet) has no bookmark of pet 3; Ana's bookmark of Biscuit is hers.
    await removeBookmark(pet, { kind: "pet", id: 3 });
    expect(await savedPetNames(as("human"))).toContain("Biscuit");

    await removeBookmark(pet, { kind: "home", id: 3 });
    expect(await savedHomeNames(pet)).toEqual(["Ana Santos"]);
  });
});
