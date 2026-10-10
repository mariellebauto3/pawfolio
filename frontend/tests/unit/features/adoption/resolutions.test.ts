import { describe, expect, it } from "vitest";
import { adminResolvePath } from "@/constants/routes";
import { applyResolution, findPets, getRecentResolutions, getResolveOptions, previewResolution, readChange } from "@/features/adoption/api/resolutions";
import { actionChoices, changeEffects, initialRequestId, requestLabel, resolutionParties, resolutionProblems, resolveTargetFromUrl } from "@/features/adoption/schemas/resolutions";
import type { ResolutionChange, ResolveOptions } from "@/features/adoption/types/resolutions";
import { type Transport, createApiClient } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// Resolve adoption issue (AL-07, AL-08, FR37): what its address may ask for, which actions the chosen request
// offers, how a change is put into words, and the calls against the mock API, which answers in the shapes of
// docs/api/adoption-and-meet-greet.md. The mock keeps what is changed in memory, so the test that applies a change
// comes last.

function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

function answering(body: unknown, status = 200) {
  const calls: { method: string; path: string; body?: unknown; query?: unknown }[] = [];
  const transport: Transport = async ({ method, path, body: sent, query }) => {
    calls.push({ method, path, body: sent, query });
    return { status, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

const failure = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (problem) {
    if (isApiError(problem)) return problem;
    throw problem;
  }
  throw new Error("Expected the call to fail.");
};

// Mochi is In Process with Ana (request 1, Meet Scheduled) while its request to Paolo is On Hold (request 2).
const MOCHI: ResolveOptions = {
  pet: { id: 1, name: "Mochi", status: "in_process", city: "Quezon City", photo_url: null, user_id: 1 },
  furparent: null,
  requests: [
    { id: 2, status: "on_hold", home_name: "Paolo Garcia", sent_at: "2026-09-19T16:00:00.000Z", closed_at: null },
    { id: 1, status: "meet_scheduled", home_name: "Ana Santos", sent_at: "2026-09-20T09:00:00.000Z", closed_at: null },
  ],
  actions: [
    { action: "cancel_adoption", available: false, request_ids: [], unavailable_reason: "Mochi hasn't been adopted, so there is no adoption to cancel." },
    { action: "return_to_looking_for_a_home", available: true, request_ids: [1], unavailable_reason: null },
    { action: "close_request", available: true, request_ids: [2], unavailable_reason: null },
    { action: "reopen_meet_greet_booking", available: true, request_ids: [1], unavailable_reason: null },
  ],
};

const CHANGE: ResolutionChange = {
  pet_name: "Luna",
  action: "cancel_adoption",
  request: { id: 6, home_name: "Ana Santos" },
  before: { pet_status: "adopted_hired", request_status: "adopted", furparent_name: "Ana Santos" },
  after: { pet_status: "looking_for_a_home", request_status: "closed", furparent_name: null },
  requests_restored: 0,
  meeting_ended: false,
};

describe("the Resolve page's address", () => {
  it("reads a pet, a request and a search, and only plain ids", () => {
    expect(resolveTargetFromUrl({ pet: "3", request: "12" })).toEqual({ petId: 3, requestId: 12, search: undefined });
    expect(resolveTargetFromUrl({ q: "  luna " })).toEqual({ petId: null, requestId: null, search: "luna" });
    expect(resolveTargetFromUrl({ pet: "3/../4", request: "abc", q: "" })).toEqual({ petId: null, requestId: null, search: undefined });
    expect(resolveTargetFromUrl({ pet: ["7", "8"], q: "x".repeat(300) })).toMatchObject({ petId: 7 });
    expect(resolveTargetFromUrl({ q: "x".repeat(300) }).search).toHaveLength(100);
  });

  it("builds the link from a pet and, when the issue is about one, its request", () => {
    expect(adminResolvePath(4)).toBe("/admin/resolve?pet=4");
    expect(adminResolvePath(4, 6)).toBe("/admin/resolve?pet=4&request=6");
  });
});

describe("which action the chosen request offers", () => {
  it("starts on the request the address names when it is the pet's, otherwise on the only one there is", () => {
    expect(initialRequestId(MOCHI, 2)).toBe(2);
    // Another pet's request isn't picked: two requests could be acted on, so the admin chooses.
    expect(initialRequestId(MOCHI, 99)).toBeNull();
    expect(initialRequestId(MOCHI, null)).toBeNull();
    const oneOnly = { ...MOCHI, actions: MOCHI.actions.map((option) => (option.action === "close_request" ? { ...option, available: false, request_ids: [] } : option)) };
    expect(initialRequestId(oneOnly, null)).toBe(1);
  });

  it("enables only what applies to the chosen request, and says why for the rest", () => {
    const forInProcess = actionChoices(MOCHI, 1);
    expect(forInProcess.map((choice) => [choice.action, choice.enabled])).toEqual([
      ["cancel_adoption", false],
      ["return_to_looking_for_a_home", true],
      ["close_request", false],
      ["reopen_meet_greet_booking", true],
    ]);
    // The API's own reason for what isn't available at all, and where an action applies instead.
    expect(forInProcess[0].description).toBe("Mochi hasn't been adopted, so there is no adoption to cancel.");
    expect(forInProcess[2].description).toBe("Doesn’t apply to this request. It applies to the request to Paolo Garcia.");

    expect(actionChoices(MOCHI, 2).filter((choice) => choice.enabled).map((choice) => choice.action)).toEqual(["close_request"]);

    const noRequest = actionChoices(MOCHI, null);
    expect(noRequest.every((choice) => !choice.enabled)).toBe(true);
    expect(noRequest[1].description).toBe("Choose the request it is for. It applies to the request to Ana Santos.");
  });

  it("offers an action that changes the pet alone without a request", () => {
    const stuck: ResolveOptions = { ...MOCHI, requests: [], actions: MOCHI.actions.map((option) => ({ ...option, available: option.action === "return_to_looking_for_a_home", request_ids: [] })) };
    expect(actionChoices(stuck, null).filter((choice) => choice.enabled).map((choice) => choice.action)).toEqual(["return_to_looking_for_a_home"]);
  });

  it("names a request by its home, status and day", () => {
    expect(requestLabel(MOCHI.requests[1])).toBe("Ana Santos, Meet Scheduled, sent Sep 20, 2026 (#1)");
    expect(requestLabel({ id: 9, status: "closed", home_name: null, sent_at: null, closed_at: null })).toBe("A home, Closed (#9)");
  });
});

describe("the form's rules and the change in words", () => {
  it("asks for an action and a reason", () => {
    expect(resolutionProblems({ action: null, reason: "   " })).toEqual({ action: "Choose what to change.", reason: "Enter a reason for this change." });
    expect(resolutionProblems({ action: "close_request", reason: "x".repeat(1001) })).toEqual({ reason: "Keep the reason to 1000 characters or fewer." });
    expect(resolutionProblems({ action: "close_request", reason: "Sent by mistake." })).toEqual({});
  });

  it("says what else moves with a change", () => {
    expect(changeEffects(CHANGE)).toEqual(["The Furparent link to Ana Santos is removed. Ana Santos keeps the Furparent label."]);
    expect(changeEffects({ ...CHANGE, before: { ...CHANGE.before, furparent_name: null }, requests_restored: 2, meeting_ended: true })).toEqual([
      "2 requests On Hold go back to Sent, with a fresh 14 days.",
      "The Meet & Greet that is booked for this request is ended.",
    ]);
    expect(changeEffects({ ...CHANGE, before: { ...CHANGE.before, furparent_name: null }, requests_restored: 1 })).toEqual(["1 request On Hold goes back to Sent, with a fresh 14 days."]);
    expect(resolutionParties({ pet: { id: 4, name: "Luna" }, home_name: "Ana Santos" })).toBe("Luna and Ana Santos");
    expect(resolutionParties({ pet: null, home_name: null })).toBe("A pet");
  });
});

describe("reading what the API answers", () => {
  it("offers an action only on a plain true, and only for the pet's own requests", async () => {
    const answer = {
      pet: { id: 1, name: "Mochi", status: "in_process", user_id: 1 },
      furparent: { home_profile_id: "1" },
      requests: [{ id: 1, status: "meet_scheduled", home_name: "Ana Santos" }, { id: 2, status: "teleported" }],
      actions: [{ action: "close_request", available: "yes", request_ids: [1] }, { action: "reopen_meet_greet_booking", available: true, request_ids: [1, 2, 77] }, { action: "set_status", available: true }],
    };
    const options = await getResolveOptions(answering({ data: answer }).client, 1);
    expect(options.requests.map((request) => request.id)).toEqual([1]);
    expect(options.furparent).toBeNull();
    // All four are always listed, so the form can say why one isn't offered.
    expect(options.actions.map((option) => option.action)).toEqual(["cancel_adoption", "return_to_looking_for_a_home", "close_request", "reopen_meet_greet_booking"]);
    expect(options.actions.find((option) => option.action === "close_request")?.available).toBe(false);
    expect(options.actions.find((option) => option.action === "reopen_meet_greet_booking")).toMatchObject({ available: true, request_ids: [1] });
    expect(options.actions.find((option) => option.action === "cancel_adoption")?.available).toBe(false);

    expect((await failure(() => getResolveOptions(answering({ data: { pet: { id: 1, name: "Mochi", status: "flying" } } }).client, 1))).kind).toBe("server");
  });

  it("never shows a change it can't read", () => {
    expect(readChange(CHANGE)).toEqual(CHANGE);
    expect(readChange({ ...CHANGE, after: { pet_status: "sold" } })).toBeNull();
    expect(readChange({ ...CHANGE, action: "set_status" })).toBeNull();
    expect(readChange({ ...CHANGE, requests_restored: "3", meeting_ended: 1 })).toMatchObject({ requests_restored: 0, meeting_ended: false });
  });
});

describe("what is sent", () => {
  it("sends an action, its request and the reason, and never a status", async () => {
    const applied = { id: 1, action: "cancel_adoption", reason: "Returned.", pet: { id: 4, name: "Luna" }, adoption_request_id: 6, home_name: "Ana Santos", admin_name: "admin.jess", created_at: "2026-10-10T02:00:00.000Z" };
    const { client, calls } = answering({ data: applied });
    await applyResolution(client, 4, { action: "cancel_adoption", requestId: 6, reason: "  Returned.  " });
    expect(calls[0]).toEqual({ method: "POST", path: "/admin/adoptions/4/resolve", body: { action: "cancel_adoption", adoption_request_id: 6, reason: "Returned." }, query: undefined });

    const preview = answering({ data: CHANGE });
    await previewResolution(preview.client, 4, { action: "return_to_looking_for_a_home", requestId: null });
    expect(preview.calls[0]).toMatchObject({ path: "/admin/adoptions/4/resolve/preview", body: { action: "return_to_looking_for_a_home" } });
    expect(JSON.stringify([calls[0].body, preview.calls[0].body])).not.toMatch(/status/);

    // An answer that isn't a resolution is not a change we can vouch for.
    expect((await failure(() => applyResolution(answering({ data: { id: 1 } }).client, 4, { action: "cancel_adoption", requestId: 6, reason: "x" }))).kind).toBe("server");
  });

  it("searches pets through the accounts list and keeps the pet's summary only", async () => {
    const row = { id: 9, role: "pet", status: "active", email: "luna@example.com", display_name: "Luna", caretaker_name: "Carmi Reyes", pet: { id: 4, name: "Luna", city: "Quezon City", status: "adopted_hired", photo_url: null } };
    const { client, calls } = answering({ data: [row, { id: 2, role: "human", pet: null }], meta: { total: 12 } });
    const found = await findPets(client, "lun");
    expect(calls[0]).toMatchObject({ path: "/admin/accounts", query: { tab: "pet", q: "lun" } });
    expect(found).toEqual({ pets: [{ id: 4, name: "Luna", status: "adopted_hired", city: "Quezon City", photo_url: null, caretaker_name: "Carmi Reyes" }], total: 12 });
    expect(JSON.stringify(found)).not.toContain("luna@example.com");
  });
});

describe("against the mock API", () => {
  it("is for admins only", async () => {
    expect((await failure(() => getResolveOptions(as("human"), 4))).status).toBe(403);
    expect((await failure(() => applyResolution(as("pet"), 1, { action: "close_request", requestId: 2, reason: "Mine." }))).status).toBe(403);
    expect((await failure(() => getResolveOptions(as("admin"), 999))).kind).toBe("not_found");
  });

  it("offers each pet what applies to it", async () => {
    const admin = as("admin");
    const luna = await getResolveOptions(admin, 4);
    expect(luna.furparent).toMatchObject({ full_name: "Ana Santos", adoption_request_id: 6 });
    expect(luna.actions.filter((option) => option.available).map((option) => option.action)).toEqual(["cancel_adoption"]);

    const mochi = await getResolveOptions(admin, 1);
    expect(mochi.actions.filter((option) => option.available).map((option) => option.action)).toEqual(["return_to_looking_for_a_home", "close_request", "reopen_meet_greet_booking"]);
    expect(actionChoices(mochi, 1).filter((choice) => choice.enabled).map((choice) => choice.action)).toEqual(["return_to_looking_for_a_home", "reopen_meet_greet_booking"]);
  });

  it("previews without changing anything, refuses what doesn't apply, and applies with a reason", async () => {
    const admin = as("admin");
    const change = await previewResolution(admin, 4, { action: "cancel_adoption", requestId: 6 });
    expect(change).toMatchObject({ before: { pet_status: "adopted_hired", request_status: "adopted", furparent_name: "Ana Santos" }, after: { pet_status: "looking_for_a_home", request_status: "closed", furparent_name: null } });
    expect((await getResolveOptions(admin, 4)).pet.status).toBe("adopted_hired");
    expect((await getRecentResolutions(admin)).data).toEqual([]);

    expect(await failure(() => previewResolution(admin, 4, { action: "close_request", requestId: 6 }))).toMatchObject({ kind: "conflict", code: "resolution_not_available" });
    expect((await failure(() => applyResolution(admin, 4, { action: "cancel_adoption", requestId: 6, reason: "   " }))).fieldErrors.reason).toBeDefined();

    const resolution = await applyResolution(admin, 4, { action: "cancel_adoption", requestId: 6, reason: "Returned on Sep 20 because of a severe allergy." });
    expect(resolution).toMatchObject({ action: "cancel_adoption", pet: { name: "Luna" }, home_name: "Ana Santos", admin_name: "admin.jess" });

    const after = await getResolveOptions(admin, 4);
    expect(after.pet.status).toBe("looking_for_a_home");
    expect(after.furparent).toBeNull();
    expect(after.actions.every((option) => !option.available)).toBe(true);
    expect((await getRecentResolutions(admin)).data.map((row) => row.reason)).toEqual(["Returned on Sep 20 because of a severe allergy."]);
    // Done once: there is no adoption left to cancel.
    expect(await failure(() => applyResolution(admin, 4, { action: "cancel_adoption", requestId: 6, reason: "Again." }))).toMatchObject({ kind: "conflict" });
  });
});
