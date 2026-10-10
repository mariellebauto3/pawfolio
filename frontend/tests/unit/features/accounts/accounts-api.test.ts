import { describe, expect, it } from "vitest";
import { getAccount, getAccounts, reactivateAccount, reviewChangeRequest, suspendAccount, toAccountSummary } from "@/features/accounts/api/admin-accounts";
import { changePassword, deactivateOwnAccount, getSettings, requestChange, updateContactDetails, updateNotificationPreference } from "@/features/accounts/api/settings";
import { type Transport, createApiClient } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The settings and admin account calls against the mock API, which answers in the shapes of
// docs/api/community-reports-and-admin.md. The mock keeps what is saved in memory for the whole file, so the tests
// that change it come last.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body` and `status`, and remembers what it was asked. */
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

const ACCOUNT = { id: 17, role: "pet", status: "active", email: "pepper@example.com", display_name: "Pepper", avatar_url: null, profile_id: 10, pet: { id: 10, name: "Pepper", city: "Marikina", status: "looking_for_a_home", photo_url: null }, home_profile: null, caretaker_name: "Rosie Roberts", adoption: null, created_at: "2026-10-08T06:10:00.000000Z" };

describe("reading what the API answers", () => {
  it("keeps an account that matches the contract and refuses one the screens can't place", () => {
    expect(toAccountSummary(ACCOUNT)).toMatchObject({ id: 17, status: "active", pet: { status: "looking_for_a_home" }, caretaker_name: "Rosie Roberts" });
    expect(toAccountSummary({ ...ACCOUNT, role: "admin" })).toBeNull();
    expect(toAccountSummary({ ...ACCOUNT, status: "banned" })).toBeNull();
    expect(toAccountSummary({ ...ACCOUNT, id: "17" })).toBeNull();
  });

  it("leaves a broken row out of an account page", async () => {
    const page = { ...ACCOUNT, account_actions: [{ id: 1, action: "suspend", reason: "Spam.", performed_by: "admin.jess", by_owner: false, created_at: ACCOUNT.created_at }, { id: 2, action: "promote" }], requests: [{ id: 3, status: "teleported" }], reports_against: { total: 2, open: "1" }, detail_change_requests: [], recent_activity: [], verification: null };
    const account = await getAccount(answering({ data: page }).client, 17);
    expect(account.account_actions).toHaveLength(1);
    expect(account.requests).toEqual([]);
    expect(account.reports_against).toEqual({ total: 2, open: 0, latest: [] });
  });

  it("reads settings without a role as a broken answer", async () => {
    expect((await failure(() => getSettings(answering({ data: { account: { id: 1, role: "admin", status: "active" } } }).client))).kind).toBe("server");
  });
});

describe("what is sent", () => {
  it("never sends a status or a role, only the action and its reason", async () => {
    const { client, calls } = answering({ data: ACCOUNT });
    await suspendAccount(client, 17, "Spam.");
    await reactivateAccount(client, 17, "Appeal resolved.");
    expect(calls.map((call) => [call.path, call.body])).toEqual([
      ["/admin/accounts/17/suspend", { reason: "Spam." }],
      ["/admin/accounts/17/reactivate", { reason: "Appeal resolved." }],
    ]);
  });

  it("asks for a tab, a status and a search, leaving out All", async () => {
    const { client, calls } = answering({ data: [], meta: { total: 0, current_page: 1, last_page: 1 }, links: {} });
    await getAccounts(client, { tab: "all", status: "suspended", search: "moch", page: 2 });
    expect(calls[0].query).toEqual({ tab: undefined, status: "suspended", q: "moch", page: 2, per_page: undefined });
  });

  it("sends a change request with a document as a form, and without one as plain fields", async () => {
    const { client, calls } = answering({ data: { id: 1, field: "breed", new_value: "Poodle", reason: "Vet.", status: "pending", has_document: true, created_at: ACCOUNT.created_at } }, 201);
    await requestChange(client, { field: "breed", new_value: "Poodle", reason: "Vet.", document: new File(["%PDF-1.4"], "vet.pdf", { type: "application/pdf" }) });
    await requestChange(client, { field: "breed", new_value: "Poodle", reason: "Vet." });
    expect(calls[0].body).toBeInstanceOf(FormData);
    expect((calls[0].body as FormData).get("field")).toBe("breed");
    expect(calls[1].body).toEqual({ field: "breed", new_value: "Poodle", reason: "Vet." });
  });

  it("closes the owner's account without the sign-in redirect a later 401 would bring", async () => {
    const { client, calls } = answering({ data: { deactivated: true } });
    await deactivateOwnAccount(client, { password: "password", reason: null });
    expect(calls[0]).toMatchObject({ path: "/settings/deactivate", body: { password: "password", reason: null } });
  });
});

describe("the gates (mock API)", () => {
  it("refuses a member on the admin endpoints and an account that isn't Active on its settings", async () => {
    expect((await failure(() => getAccounts(as("human")))).kind).toBe("forbidden");
    expect((await failure(() => suspendAccount(as("pet"), 2, "Mine.")))).toMatchObject({ kind: "forbidden" });
    expect((await failure(() => getSettings(as("pet-suspended")))).kind).toBe("account_not_active");
    expect((await failure(() => getSettings(as("signed-out")))).kind).toBe("unauthenticated");
  });
});

describe("settings and accounts (mock API, in order)", () => {
  it("reads the persona's own settings", async () => {
    const settings = await getSettings(as("pet"));
    expect(settings.account.role).toBe("pet");
    expect(settings.locked_details).toEqual({ name: "Mochi", species: "dog", breed: "Aspin", approximate_age_months: "24" });
    expect(settings.contact_details.caretaker_contact_number).toBe("09171234567");
  });

  it("saves contact details and a switch, and refuses a number that isn't one", async () => {
    const pet = as("pet");
    expect((await failure(() => updateContactDetails(pet, { caretaker_contact_number: "12345" }))).fieldErrors.caretaker_contact_number).toBeTruthy();
    expect((await updateContactDetails(pet, { caretaker_contact_number: "+63 917 555 0199" })).contact_details.caretaker_contact_number).toBe("09175550199");
    expect((await updateNotificationPreference(pet, "post_activity", false)).notification_preferences.post_activity).toBe(false);
  });

  it("changes the password only with the current one", async () => {
    const human = as("human");
    expect((await failure(() => changePassword(human, { current_password: "nope", password: "Tennis-ball-77", password_confirmation: "Tennis-ball-77" }))).fieldErrors.current_password).toBeTruthy();
    await changePassword(human, { current_password: "password", password: "Tennis-ball-77", password_confirmation: "Tennis-ball-77" });
  });

  it("sends one change request per detail, and the admin reviews it once", async () => {
    const pet = as("pet");
    const request = await requestChange(pet, { field: "breed", new_value: "Shih Tzu mix", reason: "The vet says so." });
    expect(request).toMatchObject({ status: "pending", has_document: false });
    expect((await failure(() => requestChange(pet, { field: "breed", new_value: "Poodle", reason: "Again." }))).code).toBe("change_request_pending");

    const admin = as("admin");
    expect((await failure(() => reviewChangeRequest(admin, request.id, { decision: "denied", reason: " " }))).fieldErrors.reason).toBeTruthy();
    expect(await reviewChangeRequest(admin, request.id, { decision: "approved" })).toMatchObject({ status: "approved", current_value: "Shih Tzu mix" });
    expect((await failure(() => reviewChangeRequest(admin, request.id, { decision: "approved" }))).code).toBe("already_reviewed");
  });

  it("lists, suspends and reactivates an account, each once", async () => {
    const admin = as("admin");
    const list = await getAccounts(admin);
    expect(list.data.every((account) => account.role !== ("admin" as string))).toBe(true);
    expect((await getAccounts(admin, { tab: "alumni" })).data.map((account) => account.display_name)).toEqual(["Luna"]);
    expect((await getAccounts(admin, { status: "suspended" })).data.map((account) => account.display_name)).toEqual(["Biscuit"]);

    expect((await suspendAccount(admin, 1, "Spam.")).status).toBe("suspended");
    expect((await failure(() => suspendAccount(admin, 1, "Again."))).code).toBe("cannot_suspend");
    expect((await getAccount(admin, 1)).account_actions[0]).toMatchObject({ action: "suspend", reason: "Spam." });
    expect((await reactivateAccount(admin, 1, "Appeal resolved.")).status).toBe("active");
    expect((await failure(() => suspendAccount(admin, 1, "  "))).fieldErrors.reason).toBeTruthy();
  });
});
