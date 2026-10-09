import { describe, expect, it } from "vitest";
import { adoptPet, getAdoption, readRequestAdoption } from "@/features/adoption/api/adoptions";
import { adoptionTimeline, daysToAdoption } from "@/features/adoption/schemas/adoptions";
import type { AdoptionRecord } from "@/features/adoption/types/adoptions";
import { getInbox, getMyRequests, getRequestWith } from "@/features/adoption-requests/api/requests";
import { getHomeProfileDetail, getPetProfile } from "@/features/discovery/api/discovery";
import { readRequestMeeting } from "@/features/meet-and-greet/api/meetings";
import { type Transport, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The adoption calls against the mock API, which answers in the shapes of docs/api/adoption-and-meet-greet.md. Ana
// Santos (the `human` persona) adopted Luna (the `pet-hired` persona): adoption 1, whose record is request 6. She
// met Bantay yesterday, so request 7 waits for her decision. The mock keeps what is decided in memory for the whole
// file, so the test that adopts comes last.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body`, and remembers what it was asked. */
function answering(body: unknown) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const transport: Transport = async ({ method, path, body: sent }) => {
    calls.push({ method, path, body: sent });
    return { status: 200, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

const record = (change: Partial<AdoptionRecord> = {}): AdoptionRecord => ({
  id: 1,
  pet: { id: 4, name: "Luna", species: "cat", breed: "Puspin", city: "Quezon City", status: "adopted_hired", photo_url: null },
  home_profile: { id: 1, full_name: "Ana Santos", city: "Quezon City", profile_photo_url: null, is_furparent: true },
  adoption_request_id: 6,
  adopted_at: "2026-09-27T09:15:00.000Z",
  days_to_adoption: 15,
  cover_letter: "Hi Ana! I'm quiet and clean.",
  timeline: { sent_at: "2026-09-12T02:00:00.000Z", approved_at: "2026-09-14T05:30:00.000Z", meet_scheduled_at: "2026-09-17T08:00:00.000Z" },
  meeting: { starts_at: "2026-09-26T07:00:00.000Z", place_type: "public_spot", place_details: "Paws & Claws Café" },
  ...change,
});

describe("how an adoption is told (AL-06)", () => {
  it("goes from the request to the adoption, oldest first, with where the two met", () => {
    const events = adoptionTimeline(record());
    expect(events.map((event) => [event.id, event.title])).toEqual([
      ["sent", "Luna sent an adoption request"],
      ["approved", "Ana Santos approved it"],
      ["meet", "The Meet & Greet was confirmed"],
      ["adopted", "Ana Santos chose Adopt, and Luna got Hired"],
    ]);
    // Shown in Philippine time: 07:00 UTC is 3:00 PM.
    expect(events[2].description).toBe("They met on Sat, Sep 26, 3:00 PM at Paws & Claws Café.");
    expect(events[3].status).toBe("Adopted");
  });

  it("names a meeting at the caretaker's by its kind, and never makes up a step", () => {
    const atCaretakers = adoptionTimeline(record({ meeting: { starts_at: "2026-09-26T07:00:00.000Z", place_type: "caretaker_location", place_details: null } }));
    expect(atCaretakers[2].description).toBe("They met on Sat, Sep 26, 3:00 PM at Caretaker’s location.");

    const bare = adoptionTimeline(record({ meeting: null, timeline: { sent_at: "2026-09-12T02:00:00.000Z", approved_at: null, meet_scheduled_at: null }, adopted_at: null }));
    expect(bare.map((event) => event.id)).toEqual(["sent"]);
  });

  it("counts the days in words", () => {
    expect(daysToAdoption(15)).toBe("15 days");
    expect(daysToAdoption(1)).toBe("1 day");
    expect(daysToAdoption(null)).toBeNull();
  });
});

describe("the adoption on a request (AL-04)", () => {
  it("is read only from an Adopted request that names one", () => {
    expect(readRequestAdoption({ status: "adopted", adoption: { id: 3, adopted_at: "2026-09-27T09:15:00.000Z" } })).toEqual({ id: 3, adopted_at: "2026-09-27T09:15:00.000Z" });
    expect(readRequestAdoption({ status: "adopted", adoption: { id: 3, adopted_at: "soon" } })).toEqual({ id: 3, adopted_at: null });
    expect(readRequestAdoption({ status: "adopted", adoption: null })).toBeNull();
    expect(readRequestAdoption({ status: "adopted", adoption: { id: "3" } })).toBeNull();
    // Whatever rides along on a request that isn't Adopted is not an adoption.
    expect(readRequestAdoption({ status: "awaiting_decision", adoption: { id: 3 } })).toBeNull();
  });

  it("comes with the request, for its two sides", async () => {
    for (const side of ["human", "pet-hired"]) {
      const { request, more } = await getRequestWith(as(side), 6, readRequestAdoption);
      expect(request).toMatchObject({ status: "adopted", pet: { name: "Luna", status: "adopted_hired" } });
      expect(more).toEqual({ id: 1, adopted_at: "2026-09-27T09:15:00.000000Z" });
    }
    expect((await getRequestWith(as("human"), 7, readRequestAdoption)).more).toBeNull();
  });

  it("keeps the two sides' contact details on the record, for the handover", async () => {
    const { more } = await getRequestWith(as("pet-hired"), 6, readRequestMeeting);
    expect(more.contacts).toMatchObject({ human_full_name: "Ana Santos", caretaker_name: "Carmi Reyes" });
    expect(more.passed).toBe(false);
  });
});

describe("the adoption record (AL-06)", () => {
  it("is read by the Furparent and by the pet", async () => {
    for (const side of ["human", "pet-hired"]) {
      const read = await getAdoption(as(side), 1);
      expect(read).toMatchObject({
        id: 1,
        pet: { id: 4, name: "Luna", status: "adopted_hired" },
        home_profile: { id: 1, full_name: "Ana Santos", is_furparent: true },
        adoption_request_id: 6,
        adopted_at: "2026-09-27T09:15:00.000000Z",
        days_to_adoption: 15,
        meeting: { place_type: "public_spot", place_details: "Paws & Claws Café" },
      });
      expect(read.cover_letter).toContain("only knock over small things");
      // Where they met, never where anyone lives (SEC-PRIV-02).
      expect(JSON.stringify(read)).not.toContain("Sample St.");
    }
  });

  it("is a record that doesn't exist for anyone else", async () => {
    // Another pet, a signed-out visitor, and an id nobody has.
    await expect(getAdoption(as("pet"), 1)).rejects.toMatchObject({ kind: "not_found" });
    await expect(getAdoption(as("signed-out"), 1)).rejects.toMatchObject({ kind: "unauthenticated" });
    await expect(getAdoption(as("human"), 999)).rejects.toMatchObject({ kind: "not_found" });
    // An admin reads every adoption.
    expect((await getAdoption(as("admin"), 1)).id).toBe(1);
  });

  it("builds the path from the id, and refuses an answer that isn't a record", async () => {
    const { client, calls } = answering({ data: record() });
    expect((await getAdoption(client, 12)).pet.name).toBe("Luna");
    expect(calls).toEqual([{ method: "GET", path: "/adoptions/12", body: undefined }]);

    for (const body of [{ data: null }, { data: { id: 1 } }, { data: { ...record(), pet: null } }, { data: { ...record(), home_profile: { id: 1 } } }]) {
      await expect(getAdoption(answering(body).client, 1)).rejects.toMatchObject({ kind: "server" });
    }
  });

  it("reads what is missing or malformed as not there", async () => {
    const odd = { ...record(), days_to_adoption: 0, cover_letter: "", meeting: { starts_at: "someday", place_type: "public_spot" }, timeline: null, adopted_at: 5 };
    const read = await getAdoption(answering({ data: odd }).client, 1);
    expect(read).toMatchObject({ days_to_adoption: null, cover_letter: null, meeting: null, adopted_at: null });
    expect(read.timeline).toEqual({ sent_at: null, approved_at: null, meet_scheduled_at: null });
  });
});

describe("adopting (AL-01)", () => {
  it("sends nothing but the request's id, and expects an Adopted request with its adoption", async () => {
    const { client, calls } = answering({ data: { id: 7, status: "adopted", adoption: { id: 2, adopted_at: "2026-10-09T03:00:00.000Z" } } });
    expect(await adoptPet(client, 7)).toEqual({ id: 2, adopted_at: "2026-10-09T03:00:00.000Z" });
    expect(calls).toEqual([{ method: "POST", path: "/adoption-requests/7/adopt", body: undefined }]);

    // Anything else is not an adoption we can vouch for.
    for (const body of [{ data: { id: 7, status: "awaiting_decision", adoption: null } }, { data: { id: 7, status: "adopted" } }, { data: null }]) {
      await expect(adoptPet(answering(body).client, 7)).rejects.toMatchObject({ kind: "server" });
    }
  });

  it("is refused before the meeting time, once decided, and for anyone but the human it was sent to", async () => {
    // Mochi's Meet & Greet is still ahead; Tofu's request was declined long ago; Luna is adopted already.
    await expect(adoptPet(as("human"), 1)).rejects.toMatchObject({ kind: "conflict", code: "meeting_not_yet_passed" });
    await expect(adoptPet(as("human"), 4)).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });
    await expect(adoptPet(as("human"), 6)).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });

    await expect(adoptPet(as("pet"), 1)).rejects.toMatchObject({ kind: "not_found" });
    await expect(adoptPet(as("admin"), 7)).rejects.toMatchObject({ kind: "not_found" });
    await expect(adoptPet(as("signed-out"), 7)).rejects.toMatchObject({ kind: "unauthenticated" });
    await expect(adoptPet(as("pet-suspended"), 7)).rejects.toMatchObject({ kind: "account_not_active" });
  });

  it("makes the pet Hired, the human its Furparent, and the request the record of it", async () => {
    const human = as("human");
    const adoption = await adoptPet(human, 7);
    expect(adoption.id).toBe(2);
    expect(adoption.adopted_at).not.toBeNull();

    const { request, more } = await getRequestWith(human, 7, readRequestAdoption);
    expect(request).toMatchObject({ status: "adopted", pet: { name: "Bantay", status: "adopted_hired" }, home_profile: { is_furparent: true } });
    expect(request.closed_at).not.toBeNull();
    expect(more).toEqual(adoption);
    expect((await getInbox(human, "closed")).counts).toMatchObject({ adopted: 2 });

    // The resume is an alumni profile linked to the Furparent (AL-05), and the Furparent's profile lists the pet.
    expect((await getPetProfile(human, 7)).hired_by).toMatchObject({ adoption_id: 2, home_profile_id: 1, full_name: "Ana Santos" });
    const home = await getHomeProfileDetail(as("pet-hired"), 1);
    expect(home.adopted_pets.map((adopted) => adopted.pet.name)).toEqual(["Bantay", "Luna"]);
    expect(home.is_open_to_adopt).toBe(false);

    // The record can be read at once, and the pet can't be adopted twice.
    expect(await getAdoption(human, 2)).toMatchObject({ pet: { name: "Bantay" }, adoption_request_id: 7, meeting: { place_details: "Quezon Memorial Circle" } });
    await expect(adoptPet(human, 7)).rejects.toMatchObject({ kind: "conflict", code: "invalid_request_state" });
    // Another pet's requests are untouched.
    expect((await getMyRequests(as("pet"), "active")).meta.total).toBe(2);
  });
});
