import { describe, expect, it } from "vitest";
import { getHomeMatches, getMatchBreakdown, getPetMatches } from "@/features/matching/api/matching";
import { ALL_MATCHES } from "@/features/matching/schemas/match-view";
import { type Transport, type TransportRequest, createApiClient } from "@/lib/api/core";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The matching calls against the mock API, which answers in the shapes of docs/api/profiles-and-matching.md, and
// against answers that break that contract.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body`, remembering what it was asked. */
function answering(body: unknown, status = 200) {
  const asked: TransportRequest[] = [];
  const transport: Transport = async (request) => {
    asked.push(request);
    return { status, body, retryAfter: null };
  };
  return { client: createApiClient(transport), asked };
}

const META = { total: 0, current_page: 1, last_page: 1, per_page: 12, from: null, to: null, path: "/api/v1/matches" };

/** The matches of an eligible account, or a failed test. */
async function listed<T>(matches: Promise<{ eligible: true; page: { data: T[]; meta: { total: number } } } | { eligible: false }>) {
  const answer = await matches;
  if (!answer.eligible) throw new Error("expected matches");
  return answer.page;
}

describe("Pets for You (MT-01)", () => {
  it("lists the pets that pass the dealbreakers, best score first, each with its reasons", async () => {
    const page = await listed(getPetMatches(as("human"), ALL_MATCHES));
    expect(page.data.map((match) => [match.pet.name, match.score])).toEqual([
      ["Tofu", 91],
      ["Biscuit", 72],
      ["Pepper", 64],
    ]);
    expect(page.data.every((match) => match.pet.status === "looking_for_a_home")).toBe(true);
    expect(page.data.every((match) => match.reasons.length > 0)).toBe(true);
    expect(page.meta.total).toBe(3);
  });

  it("narrows by a quick filter and sorts by newest", async () => {
    const names = async (view: Partial<typeof ALL_MATCHES>) => (await listed(getPetMatches(as("human"), { ...ALL_MATCHES, ...view }))).data.map((match) => match.pet.name);
    expect(await names({ show: "cats" })).toEqual(["Tofu"]);
    expect(await names({ show: "dogs" })).toEqual(["Biscuit", "Pepper"]);
    expect(await names({ show: "senior" })).toEqual([]);
    expect((await names({ sort: "newest" })).sort()).toEqual(["Biscuit", "Pepper", "Tofu"]);
  });

  it("asks the list endpoint with the filter, the sort and a page of twelve", async () => {
    const { client, asked } = answering({ data: [], meta: { ...META, eligible: true, reason: null }, links: {} });
    await getPetMatches(client, { show: "small", sort: "newest", page: 2 });
    expect(asked[0]).toMatchObject({ method: "GET", path: "/matches", query: { size: "small", sort: "newest", page: 2, per_page: 12 } });
  });
});

describe("Homes for You (MT-02)", () => {
  it("lists the homes that are Open to Adopt and pass the dealbreakers", async () => {
    const page = await listed(getHomeMatches(as("pet"), ALL_MATCHES));
    expect(page.data.map((match) => [match.home_profile.full_name, match.score])).toEqual([
      ["Ana Santos", 86],
      ["Paolo Garcia", 78],
    ]);
    // Public details only: nothing private rides along (SEC-PRIV-03).
    for (const { home_profile: home } of page.data) {
      expect(home).not.toHaveProperty("street_address");
      expect(home).not.toHaveProperty("contact_number");
    }
  });

  it("narrows by the household", async () => {
    const names = async (show: string) => (await listed(getHomeMatches(as("pet"), { ...ALL_MATCHES, show }))).data.map((match) => match.home_profile.full_name);
    expect(await names("houses")).toEqual(["Paolo Garcia"]);
    expect(await names("condos")).toEqual(["Ana Santos"]);
    expect(await names("no-other-pets")).toEqual(["Paolo Garcia"]);
    expect(await names("with-kids")).toEqual([]);
  });
});

describe("an account with no matches yet (MT-04, MT-05)", () => {
  const empty = (reason: unknown) => answering({ data: [], meta: { ...META, eligible: false, reason }, links: {} }).client;

  it("reads why from the list's meta", async () => {
    expect(await getPetMatches(empty("quiz_incomplete"), ALL_MATCHES)).toEqual({ eligible: false, reason: "quiz_incomplete" });
    expect(await getHomeMatches(empty("resume_draft"), ALL_MATCHES)).toEqual({ eligible: false, reason: "resume_draft" });
    expect(await getHomeMatches(empty("already_adopted"), ALL_MATCHES)).toEqual({ eligible: false, reason: "already_adopted" });
  });

  it("falls back to the role's own reason for one it doesn't know", async () => {
    expect(await getPetMatches(empty("something_new"), ALL_MATCHES)).toEqual({ eligible: false, reason: "quiz_incomplete" });
    expect(await getHomeMatches(empty(null), ALL_MATCHES)).toEqual({ eligible: false, reason: "resume_draft" });
  });

  it("treats an empty page without that flag as no matches, not as not ready", async () => {
    const { client } = answering({ data: [], meta: META, links: {} });
    expect(await getPetMatches(client, ALL_MATCHES)).toMatchObject({ eligible: true, page: { data: [] } });
  });
});

describe("answers that break the contract", () => {
  it("refuses an answer that isn't a page", async () => {
    await expect(getPetMatches(answering({ data: { is_eligible: false, items: [] } }).client, ALL_MATCHES)).rejects.toMatchObject({ kind: "server" });
    await expect(getHomeMatches(answering({ data: [], meta: {} }).client, ALL_MATCHES)).rejects.toMatchObject({ kind: "server" });
  });

  it("leaves out rows without a score or a whole profile, and never shows the other side's rows", async () => {
    const pets = (await listed(getPetMatches(as("human"), ALL_MATCHES))).data;
    const meta = { ...META, total: 4, eligible: true, reason: null };
    const rows = [pets[0], { ...pets[1], score: "72" }, { score: 80, pet: { id: 9 } }, { score: 80, home_profile: {} }, null];

    const { client } = answering({ data: rows, meta, links: {} });
    expect((await listed(getPetMatches(client, ALL_MATCHES))).data.map((match) => match.pet.name)).toEqual(["Tofu"]);
    expect((await listed(getHomeMatches(client, ALL_MATCHES))).data).toEqual([]);
  });

  it("reads reasons as a list of sentences whatever was sent", async () => {
    const [first] = (await listed(getPetMatches(as("human"), ALL_MATCHES))).data;
    const meta = { ...META, total: 1, eligible: true, reason: null };
    const { client } = answering({ data: [{ ...first, reasons: ["Good fit", 7, null] }, { ...first, reasons: "nope" }], meta, links: {} });
    expect((await listed(getPetMatches(client, ALL_MATCHES))).data.map((match) => match.reasons)).toEqual([["Good fit"], []]);
  });
});

describe("the match breakdown (MT-03)", () => {
  it("explains a score: no dealbreaker failed, seven criteria that add up to it", async () => {
    const breakdown = await getMatchBreakdown(as("human"), 6);
    expect(breakdown.passed_dealbreakers).toBe(true);
    expect(breakdown.failed_dealbreakers).toEqual([]);
    expect(breakdown.criteria.map((criterion) => criterion.max_points)).toEqual([20, 15, 15, 15, 15, 10, 10]);
    expect(breakdown.criteria.reduce((sum, criterion) => sum + criterion.points, 0)).toBe(breakdown.score);
    expect(breakdown.score).toBe(91);
    expect(breakdown.reasons.length).toBeGreaterThan(0);
  });

  it("is the same score from the pet's side", async () => {
    // Mochi (pet 1) and Ana Santos (home 1): the human asks by the pet's id, the pet by the home's.
    expect((await getMatchBreakdown(as("pet"), 1)).score).toBe((await getMatchBreakdown(as("human"), 1)).score);
  });

  it("names a failed dealbreaker and scores nothing", async () => {
    // Luna (pet 4) has no score with Ana Santos in the fixtures: the mock answers that a dealbreaker failed.
    expect(await getMatchBreakdown(as("human"), 4)).toMatchObject({ score: 0, passed_dealbreakers: false, failed_dealbreakers: ["ok_with_other_pets"], reasons: [] });

    // A dealbreaker this screen has no words for is left out.
    const { client } = answering({
      data: { score: 0, passed_dealbreakers: false, failed_dealbreakers: ["same_province", "made_up"], criteria: [], reasons: [] },
    });
    expect(await getMatchBreakdown(client, 4)).toEqual({ score: 0, passed_dealbreakers: false, failed_dealbreakers: ["same_province"], criteria: [], reasons: [] });
  });

  it("asks by the other profile's id, encoded into the path", async () => {
    const { client, asked } = answering({ data: { score: 50, passed_dealbreakers: true, criteria: [] } });
    await getMatchBreakdown(client, 42);
    expect(asked[0]).toMatchObject({ method: "GET", path: "/matches/42/breakdown" });
  });

  it("answers not found for a profile the viewer may not open, and for an account without matches", async () => {
    // Kulit's resume (pet 2) is a Draft; Carla Mendoza (home 2) hasn't finished the quiz.
    await expect(getMatchBreakdown(as("human"), 2)).rejects.toMatchObject({ kind: "not_found" });
    await expect(getMatchBreakdown(as("pet"), 2)).rejects.toMatchObject({ kind: "not_found" });
    await expect(getMatchBreakdown(as("human"), 999)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("refuses an answer that isn't a breakdown and drops criteria it can't draw", async () => {
    await expect(getMatchBreakdown(answering({ data: { score: 80 } }).client, 1)).rejects.toMatchObject({ kind: "server" });
    await expect(getMatchBreakdown(answering({ data: null }).client, 1)).rejects.toMatchObject({ kind: "server" });

    const criteria = [{ key: "activity", label: "Activity", points: 14, max_points: 20 }, { key: "space", label: "Space", points: 5, max_points: 0 }, { key: "x" }];
    const { client } = answering({ data: { score: 14, passed_dealbreakers: true, criteria } });
    expect((await getMatchBreakdown(client, 1)).criteria).toEqual([criteria[0]]);
  });
});

describe("who has matches", () => {
  it("refuses an admin and a signed-out visitor", async () => {
    await expect(getPetMatches(as("admin"), ALL_MATCHES)).rejects.toMatchObject({ kind: "forbidden" });
    await expect(getMatchBreakdown(as("admin"), 1)).rejects.toMatchObject({ kind: "forbidden" });
    await expect(getPetMatches(as("signed-out"), ALL_MATCHES)).rejects.toMatchObject({ kind: "unauthenticated" });
  });

  it("refuses an account that isn't Active", async () => {
    await expect(getHomeMatches(as("pet-pending"), ALL_MATCHES)).rejects.toMatchObject({ kind: "account_not_active" });
  });
});
