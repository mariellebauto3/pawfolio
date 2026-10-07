import { describe, expect, it } from "vitest";
import { applyStateFor } from "@/features/discovery/schemas/apply-state";
import { resultCount, searchFromUrl, searchHref, searchKindFromUrl, searchPageFromUrl } from "@/features/discovery/schemas/search";
import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { RequestStatus } from "@/types/statuses";

const NOW = new Date("2026-10-07T04:00:00.000Z");
const OPEN_HOME = { id: 7, is_open_to_adopt: true };

function request(status: RequestStatus, change: Partial<AdoptionRequest> = {}): AdoptionRequest {
  return { ...ADOPTION_REQUESTS[0], id: 90, status, closed_at: null, home_profile: { ...ADOPTION_REQUESTS[0].home_profile, id: 7 }, ...change };
}

describe("what a pet can do about a home (DS-07)", () => {
  it("can apply when it has no request with the home", () => {
    expect(applyStateFor(OPEN_HOME, [], NOW)).toEqual({ kind: "can_apply" });
    // Requests with other homes don't count.
    const elsewhere = request("sent", { home_profile: { ...ADOPTION_REQUESTS[0].home_profile, id: 8 } });
    expect(applyStateFor(OPEN_HOME, [elsewhere], NOW)).toEqual({ kind: "can_apply" });
  });

  it.each<RequestStatus>(["sent", "on_hold", "approved", "meet_scheduled", "awaiting_decision"])(
    "shows the request instead of Apply while it is %s",
    (status) => {
      expect(applyStateFor(OPEN_HOME, [request(status, { id: 12 })], NOW)).toEqual({ kind: "open", requestId: 12, status });
    },
  );

  it("still shows an open request when the home has turned Open to Adopt off", () => {
    const state = applyStateFor({ id: 7, is_open_to_adopt: false }, [request("approved", { id: 12 })], NOW);
    expect(state).toMatchObject({ kind: "open", requestId: 12 });
  });

  it("offers nothing when the home isn't accepting requests", () => {
    expect(applyStateFor({ id: 7, is_open_to_adopt: false }, [], NOW)).toEqual({ kind: "not_accepting" });
  });

  it.each<RequestStatus>(["declined", "not_adopted"])("waits 30 days after %s", (status) => {
    const closed = request(status, { closed_at: "2026-09-27T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [closed], NOW)).toEqual({ kind: "cooldown", until: new Date("2026-10-27T04:00:00.000Z") });
  });

  it("counts the cooldown from the latest ending", () => {
    const earlier = request("declined", { id: 1, closed_at: "2026-09-10T04:00:00.000Z" });
    const later = request("not_adopted", { id: 2, closed_at: "2026-09-30T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [earlier, later], NOW)).toEqual({ kind: "cooldown", until: new Date("2026-10-30T04:00:00.000Z") });
  });

  it("can apply again once the 30 days are over", () => {
    const closed = request("declined", { closed_at: "2026-09-01T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [closed], NOW)).toEqual({ kind: "can_apply" });
  });

  it.each<RequestStatus>(["withdrawn", "expired", "closed"])("has no cooldown after %s", (status) => {
    const closed = request(status, { closed_at: "2026-10-06T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [closed], NOW)).toEqual({ kind: "can_apply" });
  });

  it("ignores an ending with no date rather than guessing one", () => {
    expect(applyStateFor(OPEN_HOME, [request("declined", { closed_at: null })], NOW)).toEqual({ kind: "can_apply" });
    expect(applyStateFor(OPEN_HOME, [request("declined", { closed_at: "not a date" })], NOW)).toEqual({ kind: "can_apply" });
  });
});

describe("the search page's URL (DS-03)", () => {
  it("reads the words, trimmed and capped", () => {
    expect(searchFromUrl({ q: "  quezon city " })).toBe("quezon city");
    expect(searchFromUrl({ q: ["aspin", "puspin"] })).toBe("aspin");
    expect(searchFromUrl({ q: "a".repeat(300) })).toHaveLength(100);
    expect(searchFromUrl({})).toBe("");
  });

  it("reads the open kind and its page, and falls back to the overview and page 1", () => {
    expect(searchKindFromUrl({ type: "homes" })).toBe("homes");
    expect(searchKindFromUrl({ type: "accounts" })).toBeNull();
    expect(searchKindFromUrl({})).toBeNull();
    expect(searchPageFromUrl({ page: "3" })).toBe(3);
    expect(searchPageFromUrl({ page: "0" })).toBe(1);
    expect(searchPageFromUrl({ page: "two" })).toBe(1);
  });

  it("writes the address of a search, a kind and a page", () => {
    expect(searchHref("quezon city")).toBe("/search?q=quezon+city");
    expect(searchHref("aspin", "pets")).toBe("/search?q=aspin&type=pets");
    expect(searchHref("aspin", "pets", 3)).toBe("/search?q=aspin&type=pets&page=3");
    // The overview has no pages.
    expect(searchHref("aspin", null, 3)).toBe("/search?q=aspin");
  });

  it("counts results", () => {
    expect(resultCount(1)).toBe("1 result");
    expect(resultCount(12)).toBe("12 results");
  });
});
