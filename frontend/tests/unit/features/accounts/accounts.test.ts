import { describe, expect, it } from "vitest";
import {
  accountActionsFor,
  accountFiltersFromUrl,
  accountIdFromUrl,
  activityLabel,
  ageInMonths,
  changeRequestProblems,
  contactProblems,
  formatLockedValue,
  leavingReason,
  lockedFieldsFor,
  passwordProblems,
  statusHistory,
} from "@/features/accounts/schemas/accounts";

const TODAY = new Date("2026-10-10T00:00:00");

describe("verified details and a change to them (AC-01…AC-03)", () => {
  it("lists each role's locked details", () => {
    expect(lockedFieldsFor("pet")).toEqual(["name", "species", "breed", "approximate_age_months"]);
    expect(lockedFieldsFor("human")).toEqual(["full_name", "birthdate", "city", "province"]);
  });

  it("writes a detail the way people read it", () => {
    expect(formatLockedValue("species", "dog")).toBe("Dog");
    expect(formatLockedValue("approximate_age_months", "26")).toBe("2 years 2 months");
    expect(formatLockedValue("birthdate", "1990-03-04")).toBe("Mar 4, 1990");
    expect(formatLockedValue("breed", "")).toBe("Not set");
  });

  it("turns an age with its unit into months", () => {
    expect(ageInMonths("2", "years")).toBe(24);
    expect(ageInMonths("8", "months")).toBe(8);
    expect(ageInMonths("two", "years")).toBeNull();
    expect(ageInMonths("1.5", "years")).toBeNull();
  });

  it("holds the new value to the sign-up rule it replaces, and to something new", () => {
    const ask = (field: Parameters<typeof changeRequestProblems>[0]["field"], value: string, current?: string) => changeRequestProblems({ field, new_value: value, reason: "The vet says so." }, current, TODAY);
    expect(ask(null, "x")).toHaveProperty("field");
    expect(ask("species", "dragon")).toHaveProperty("new_value");
    expect(ask("species", "cat", "dog")).toEqual({});
    expect(ask("approximate_age_months", "0")).toHaveProperty("new_value");
    expect(ask("approximate_age_months", "361")).toHaveProperty("new_value");
    expect(ask("province", "Atlantis")).toHaveProperty("new_value");
    expect(ask("birthdate", "2015-01-01").new_value).toBe("You must be 18 or older to adopt on Pawfolio.");
    expect(ask("name", "x".repeat(51))).toHaveProperty("new_value");
    expect(ask("breed", " Aspin ", "Aspin").new_value).toBe("That is already what your account says.");
    expect(changeRequestProblems({ field: "breed", new_value: "Shih Tzu mix", reason: "  " }, "Aspin", TODAY)).toHaveProperty("reason");
  });
});

describe("contact details and the password (AC-01, AC-02, AC-04)", () => {
  it("checks the role's own contact fields", () => {
    expect(contactProblems("pet", { caretaker_name: "Joy Lim", caretaker_contact_number: "0917 123 4567" })).toEqual({});
    expect(contactProblems("pet", { caretaker_name: "", caretaker_contact_number: "12345" })).toEqual({
      caretaker_name: "Enter the caretaker's full name.",
      caretaker_contact_number: "Enter a mobile number like 0917 123 4567.",
    });
    expect(contactProblems("human", { contact_number: "+63 918 123 4567", street_address: "12 Sample St." })).toEqual({});
  });

  it("needs the current password and a new one that meets the rules, typed twice and different", () => {
    expect(passwordProblems({ current_password: "", password: "", password_confirmation: "" })).toEqual({ current_password: "Enter your current password.", password: "Enter a new password." });
    expect(passwordProblems({ current_password: "old-pass-1", password: "short", password_confirmation: "short" })).toHaveProperty("password");
    expect(passwordProblems({ current_password: "Same-pass-1", password: "Same-pass-1", password_confirmation: "Same-pass-1" }).password).toBe("Choose a password that is different from your current one.");
    expect(passwordProblems({ current_password: "old-pass-1", password: "Tennis-ball-77", password_confirmation: "Tennis-ball-78" })).toEqual({ password_confirmation: "The passwords don't match." });
    expect(passwordProblems({ current_password: "old-pass-1", password: "Tennis-ball-77", password_confirmation: "Tennis-ball-77" })).toEqual({});
  });

  it("keeps the leaving reason optional, and the owner's own words for Other", () => {
    expect(leavingReason("", "")).toBeNull();
    expect(leavingReason("No longer adopting", "ignored")).toBe("No longer adopting");
    expect(leavingReason("Other", "  Moving abroad ")).toBe("Moving abroad");
    expect(leavingReason("Other", "")).toBe("Other");
  });
});

describe("the admin's accounts (AC-06…AC-10)", () => {
  it("reads the list's filters from the address, and drops what the API doesn't know", () => {
    expect(accountFiltersFromUrl({})).toEqual({ tab: "all", status: undefined, search: undefined });
    expect(accountFiltersFromUrl({ tab: "alumni", status: "suspended", q: "  moch " })).toEqual({ tab: "alumni", status: "suspended", search: "moch" });
    expect(accountFiltersFromUrl({ tab: "admins", status: "banned", q: "" })).toEqual({ tab: "all", status: undefined, search: undefined });
    expect(accountFiltersFromUrl({ q: "x".repeat(150) }).search).toHaveLength(100);
  });

  it("reads an account id from the address and nothing else (SEC-FE-08)", () => {
    expect(accountIdFromUrl("17")).toBe(17);
    for (const bad of ["", "0", "017", "1.5", "-1", "..%2Fsuspend", "17/suspend"]) expect(accountIdFromUrl(bad)).toBeNull();
  });

  it("offers only the actions the account's status allows", () => {
    expect(accountActionsFor("active")).toEqual(["suspend", "deactivate"]);
    expect(accountActionsFor("suspended")).toEqual(["reactivate", "deactivate"]);
    expect(accountActionsFor("pending_verification")).toEqual(["deactivate"]);
    expect(accountActionsFor("deactivated")).toEqual([]);
  });

  it("tells the status history oldest first, with who acted and why", () => {
    const history = statusHistory({
      created_at: "2026-09-01T00:00:00Z",
      verification: { status: "approved", submitted_at: "2026-09-01T00:00:00Z", reviewed_at: "2026-09-02T00:00:00Z", reviewed_by: "admin.jess", documents: [] },
      account_actions: [
        { id: 2, action: "reactivate", reason: "Appeal resolved.", performed_by: "admin.mark", by_owner: false, created_at: "2026-09-20T00:00:00Z" },
        { id: 1, action: "suspend", reason: "Fake photos.", performed_by: "admin.mark", by_owner: false, created_at: "2026-09-10T00:00:00Z" },
      ],
    });
    expect(history.map((event) => [event.title, event.status])).toEqual([
      ["Signed up", "Pending Verification"],
      ["Verification approved by admin.jess", "Active"],
      ["Suspended by admin.mark", "Suspended"],
      ["Reactivated by admin.mark", "Active"],
    ]);
    expect(history[2].description).toBe("Fake photos.");

    const closed = statusHistory({ created_at: "2026-09-01T00:00:00Z", verification: null, account_actions: [{ id: 3, action: "deactivate", reason: null, performed_by: "Ana Santos", by_owner: true, created_at: "2026-09-05T00:00:00Z" }] });
    expect(closed.at(-1)).toMatchObject({ title: "Closed by the owner", status: "Deactivated" });
  });

  it("writes a log entry in plain words, even one it doesn't know", () => {
    expect(activityLabel({ action: "password_changed" })).toBe("Changed the password");
    expect(activityLabel({ action: "pet_resume_published" })).toBe("Pet resume published");
  });
});
