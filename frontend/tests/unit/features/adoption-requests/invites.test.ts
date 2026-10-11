import { describe, expect, it } from "vitest";
import { dismissInvite, getInvites, sendInvite } from "@/features/adoption-requests/api/invites";
import { INVITE_NOTE_MAX, inviteApplyState, inviteNote, validateInviteNote } from "@/features/adoption-requests/schemas/invites";
import { getPetProfile } from "@/features/discovery/api/discovery";
import { type Transport, createApiClient } from "@/lib/api/core";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The Invite to Apply calls against the mock API, which answers in the shapes of
// docs/api/bookmarks-and-invites.md. The mock keeps invites in memory for the whole file, so the tests that change
// them come last.
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

const NOW = new Date("2026-10-08T04:00:00.000Z");
const home = (open: boolean) => ({ ...HOME_PROFILES[0], is_open_to_adopt: open });

describe("what a pet can do about an invite (RQ-02)", () => {
  it("offers Apply when nothing stands in the way", () => {
    expect(inviteApplyState({ open_request_id: null, cooldown_until: null, home_profile: home(true) }, NOW)).toEqual({ kind: "can_apply" });
  });

  it("shows the request in place of Apply once the pet has applied, whatever else is true", () => {
    const invite = { open_request_id: 7, cooldown_until: "2026-11-01T00:00:00.000Z", home_profile: home(false) };
    expect(inviteApplyState(invite, NOW)).toEqual({ kind: "open", requestId: 7 });
  });

  it("says the home isn't taking requests when Open to Adopt is off", () => {
    const invite = { open_request_id: null, cooldown_until: "2026-11-01T00:00:00.000Z", home_profile: home(false) };
    expect(inviteApplyState(invite, NOW)).toEqual({ kind: "not_accepting" });
  });

  it("holds Apply back until the 30 days after a decline have passed", () => {
    const until = "2026-10-20T08:00:00.000Z";
    expect(inviteApplyState({ open_request_id: null, cooldown_until: until, home_profile: home(true) }, NOW)).toEqual({ kind: "cooldown", until });
    // The day has come, or the date can't be read: nothing to wait for.
    const passed = { open_request_id: null, cooldown_until: "2026-10-08T03:59:59.000Z", home_profile: home(true) };
    expect(inviteApplyState(passed, NOW)).toEqual({ kind: "can_apply" });
    expect(inviteApplyState({ ...passed, cooldown_until: "soon" }, NOW)).toEqual({ kind: "can_apply" });
  });
});

describe("the personal note (RQ-01)", () => {
  it("is optional, trimmed, and at most 200 characters", () => {
    expect(inviteNote("  We'd love to meet you!  ")).toBe("We'd love to meet you!");
    expect(inviteNote("   ")).toBeNull();
    expect(validateInviteNote("")).toBeNull();
    expect(validateInviteNote("a".repeat(INVITE_NOTE_MAX))).toBeNull();
    // Spaces around the note don't count against it, as on the server.
    expect(validateInviteNote(` ${"a".repeat(INVITE_NOTE_MAX)} `)).toBeNull();
    expect(validateInviteNote("a".repeat(INVITE_NOTE_MAX + 1))).toMatch(/200 characters/);
  });
});

describe("Invites to Apply (RQ-02)", () => {
  it("gives a pet its invites, newest first, with the home and what stands in the way of applying", async () => {
    const page = await getInvites(as("pet"));
    expect(page.data.map((invite) => invite.home_profile.full_name)).toEqual(["Paolo Garcia", "Ana Santos"]);
    expect(page.data.map((invite) => invite.home_profile.match_score)).toEqual([78, 86]);
    expect(page.data[0].note).toMatch(/made us smile/);
    expect(page.data[1].note).toBeNull();
    // Mochi has an open request with each of them already.
    expect(page.data.map((invite) => invite.open_request_id)).toEqual([2, 1]);
    expect(page.data.map((invite) => invite.cooldown_until)).toEqual([null, null]);
  });

  it("asks for a page of ten, and for page 1 without naming it", async () => {
    const { client, calls } = answering({ data: [], meta: { total: 0, current_page: 1, last_page: 1 } });
    await getInvites(client);
    await getInvites(client, 2);
    expect(calls.map((call) => call.query)).toEqual([{ page: undefined, per_page: 10 }, { page: 2, per_page: 10 }]);
  });

  it("reads what decides the buttons strictly", async () => {
    const meta = { total: 3, current_page: 1, last_page: 1 };
    const rows = [
      { id: 1, home_profile: HOME_PROFILES[0], note: 7, created_at: null, open_request_id: "4", cooldown_until: false },
      { id: 2, home_profile: { id: 9 } },
      null,
    ];
    const page = await getInvites(answering({ data: rows, meta }).client);
    // The first row's odd values are "not there"; the other two aren't invites at all.
    expect(page.data).toEqual([{ id: 1, note: null, created_at: null, open_request_id: null, cooldown_until: null, home_profile: HOME_PROFILES[0] }]);
    await expect(getInvites(answering({ data: [] }).client)).rejects.toMatchObject({ kind: "server" });
  });

  it("is the pet's screen only", async () => {
    await expect(getInvites(as("human"))).rejects.toMatchObject({ kind: "forbidden" });
    await expect(getInvites(as("admin"))).rejects.toMatchObject({ kind: "forbidden" });
    await expect(getInvites(as("pet-pending"))).rejects.toMatchObject({ kind: "account_not_active" });
  });
});

describe("sending an invite (RQ-01)", () => {
  it("sends only the note, to the pet's own path", async () => {
    const sent = { id: 5, pet_id: 3, home_profile_id: 1, note: "Hello", created_at: "2026-10-08T04:00:00.000000Z" };
    const { client, calls } = answering({ data: sent });
    expect(await sendInvite(client, 3, "Hello")).toEqual(sent);
    expect(calls).toEqual([{ method: "POST", path: "/pets/3/invites", body: { note: "Hello" }, query: undefined }]);
    // An answer without the invite isn't taken as "sent".
    await expect(sendInvite(answering({ data: { id: "5" } }).client, 3, null)).rejects.toMatchObject({ kind: "server" });
  });

  it("is refused for the reasons the API gives", async () => {
    const human = as("human");
    // Only a human invites.
    await expect(sendInvite(as("pet"), 3, null)).rejects.toMatchObject({ kind: "forbidden" });
    // A Draft answers like a pet that doesn't exist.
    await expect(sendInvite(human, 2, null)).rejects.toMatchObject({ kind: "not_found" });
    // Mochi is In Process and Luna is adopted: neither is Looking for a Home.
    await expect(sendInvite(human, 1, null)).rejects.toMatchObject({ kind: "conflict", code: "pet_not_looking_for_home" });
    await expect(sendInvite(human, 4, null)).rejects.toMatchObject({ kind: "conflict", code: "pet_not_looking_for_home" });
    // Pepper has already applied to Ana's home.
    await expect(sendInvite(human, 5, null)).rejects.toMatchObject({ kind: "conflict", code: "request_already_open" });
    await expect(sendInvite(human, 3, "a".repeat(INVITE_NOTE_MAX + 1))).rejects.toMatchObject({ kind: "validation", fieldErrors: { note: expect.any(String) } });
  });

  it("goes out once: a second one is refused while the first is live", async () => {
    const human = as("human");
    expect((await getPetProfile(human, 3)).invited_at).toBeNull();

    const invite = await sendInvite(human, 3, "  We have a yard waiting for you.  ");
    expect(invite).toMatchObject({ pet_id: 3, home_profile_id: 1, note: "We have a yard waiting for you." });
    await expect(sendInvite(human, 3, null)).rejects.toMatchObject({ kind: "conflict", code: "invite_already_sent" });

    // The resume now tells this human their invite is out, so the page shows "Invite sent" (RQ-01).
    expect((await getPetProfile(human, 3)).invited_at).toBe(invite.created_at);
    // Only the human who sent it is told; and anything but a date reads as "not invited".
    expect((await getPetProfile(as("pet"), 3)).invited_at).toBeNull();
    const odd = { ...(await as("human").get<{ data: object }>("/pets/3")).data, invited_at: 5 };
    expect((await getPetProfile(answering({ data: odd }).client, 3)).invited_at).toBeNull();
  });
});

describe("dismissing an invite (RQ-02)", () => {
  it("is for the invited pet only", async () => {
    // The human who sent it, and an id that doesn't exist, get the same answer.
    await expect(dismissInvite(as("human"), 1)).rejects.toMatchObject({ kind: "not_found" });
    await expect(dismissInvite(as("pet"), 999)).rejects.toMatchObject({ kind: "not_found" });
    expect((await getInvites(as("pet"))).meta.total).toBe(2);
  });

  it("takes the invite off the list, and pressing twice is not an error", async () => {
    const pet = as("pet");
    await dismissInvite(pet, 1);
    await dismissInvite(pet, 1);
    expect((await getInvites(pet)).data.map((invite) => invite.home_profile.full_name)).toEqual(["Ana Santos"]);
  });
});
