import { describe, expect, it } from "vitest";
import { applyStateFor, isApplyBlocker } from "@/features/adoption-requests/schemas/apply-state";
import { ADOPTION_REQUESTS } from "@/lib/api/mock/fixtures/adoption-requests";
import type { AdoptionRequest } from "@/types/adoption-request";
import type { RequestStatus } from "@/types/statuses";

const NOW = new Date("2026-10-07T04:00:00.000Z");
const OPEN_HOME = { id: 7, is_open_to_adopt: true };

const homeNamed = (id: number, full_name = `Home ${id}`) => ({ ...ADOPTION_REQUESTS[0].home_profile, id, full_name, profile_photo_url: null });

/** A request with home 7 unless `change` names another. */
function request(status: RequestStatus, change: Partial<AdoptionRequest> = {}): AdoptionRequest {
  return { ...ADOPTION_REQUESTS[0], id: 90, status, sent_at: "2026-09-20T04:00:00.000Z", closed_at: null, home_profile: homeNamed(7), ...change };
}

const elsewhere = (id: number, status: RequestStatus) => request(status, { id, home_profile: homeNamed(id) });

describe("what a pet can do about a home (DS-07, RQ-03)", () => {
  it("can apply when it has no request with the home", () => {
    expect(applyStateFor(OPEN_HOME, [], NOW)).toEqual({ kind: "can_apply" });
    // Requests with other homes don't count until there are three, or one is in process.
    expect(applyStateFor(OPEN_HOME, [elsewhere(8, "sent"), elsewhere(9, "sent")], NOW)).toEqual({ kind: "can_apply" });
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
    // That comes before the pet's own limits: nobody can apply there.
    expect(applyStateFor({ id: 7, is_open_to_adopt: false }, [elsewhere(8, "approved")], NOW)).toEqual({ kind: "not_accepting" });
  });
});

describe("the cooldown after a decline (RQ-06)", () => {
  it.each<RequestStatus>(["declined", "not_adopted"])("waits 30 days after %s, and says which request ended so", (status) => {
    const closed = request(status, { closed_at: "2026-09-27T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [closed], NOW)).toEqual({
      kind: "cooldown",
      until: "2026-10-27T04:00:00.000Z",
      last: { status, sent_at: "2026-09-20T04:00:00.000Z", closed_at: "2026-09-27T04:00:00.000Z" },
    });
  });

  it("counts from the latest ending", () => {
    const earlier = request("declined", { id: 1, closed_at: "2026-09-10T04:00:00.000Z" });
    const later = request("not_adopted", { id: 2, closed_at: "2026-09-30T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [earlier, later], NOW)).toMatchObject({ kind: "cooldown", until: "2026-10-30T04:00:00.000Z", last: { status: "not_adopted" } });
  });

  it("is over after 30 days", () => {
    const closed = request("declined", { closed_at: "2026-09-01T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [closed], NOW)).toEqual({ kind: "can_apply" });
  });

  it.each<RequestStatus>(["withdrawn", "expired", "closed"])("doesn't follow %s", (status) => {
    const closed = request(status, { closed_at: "2026-10-06T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [closed], NOW)).toEqual({ kind: "can_apply" });
  });

  it("ignores an ending with no date rather than guessing one", () => {
    expect(applyStateFor(OPEN_HOME, [request("declined", { closed_at: null })], NOW)).toEqual({ kind: "can_apply" });
    expect(applyStateFor(OPEN_HOME, [request("declined", { closed_at: "not a date" })], NOW)).toEqual({ kind: "can_apply" });
  });

  it("is about this home only", () => {
    const declinedElsewhere = request("declined", { home_profile: homeNamed(8), closed_at: "2026-10-06T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [declinedElsewhere], NOW)).toEqual({ kind: "can_apply" });
  });
});

describe("the pet's own limits (RQ-05, proposal §5.5)", () => {
  it("stops a fourth request, and lists the three that are open", () => {
    const state = applyStateFor(OPEN_HOME, [elsewhere(8, "sent"), elsewhere(9, "sent"), elsewhere(10, "sent"), elsewhere(11, "withdrawn")], NOW);
    expect(state).toEqual({
      kind: "limit",
      open: [8, 9, 10].map((id) => ({ id, status: "sent", home: { id, full_name: `Home ${id}`, profile_photo_url: null } })),
    });
  });

  it.each<RequestStatus>(["approved", "meet_scheduled", "awaiting_decision"])("stops any request while another is %s", (status) => {
    const state = applyStateFor(OPEN_HOME, [elsewhere(8, status), elsewhere(9, "on_hold")], NOW);
    expect(state).toEqual({ kind: "in_process", request: { id: 8, status, home: { id: 8, full_name: "Home 8", profile_photo_url: null } } });
  });

  it("names the request in process before the limit, as the API does", () => {
    const state = applyStateFor(OPEN_HOME, [elsewhere(8, "on_hold"), elsewhere(9, "meet_scheduled"), elsewhere(10, "on_hold")], NOW);
    expect(state).toMatchObject({ kind: "in_process", request: { id: 9 } });
  });

  it("names this home's cooldown before the pet's limits", () => {
    const closed = request("declined", { closed_at: "2026-10-01T04:00:00.000Z" });
    expect(applyStateFor(OPEN_HOME, [closed, elsewhere(8, "approved")], NOW)).toMatchObject({ kind: "cooldown" });
  });

  it("knows which states a dialog explains", () => {
    expect(isApplyBlocker(applyStateFor(OPEN_HOME, [elsewhere(8, "approved")], NOW))).toBe(true);
    expect(isApplyBlocker({ kind: "can_apply" })).toBe(false);
    expect(isApplyBlocker({ kind: "not_accepting" })).toBe(false);
    expect(isApplyBlocker({ kind: "open", requestId: 1, status: "sent" })).toBe(false);
  });
});
