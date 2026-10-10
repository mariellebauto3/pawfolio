import { describe, expect, it } from "vitest";
import { getAccountStatus, updateSubmission } from "@/features/auth/api/account-status";
import {
  approveVerification,
  denyVerification,
  getVerificationDocument,
  getVerificationQueue,
  getVerificationQueueSize,
  getVerificationReview,
} from "@/features/auth/api/verification-review";
import { type ApiClient, createApiClient } from "@/lib/api/core";
import { encodeMockDecisions, parseMockDecisions, withMockDecision } from "@/lib/api/mock/decisions";
import { ALREADY_REVIEWED_CODE } from "@/lib/api/mock/handlers/admin-verification";
import { MOCK_PASSWORD, MOCK_PERSONAS } from "@/lib/api/mock/personas";
import { MOCK_DECISIONS_COOKIE, MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";
import { AUTH_ENDPOINTS } from "@/lib/auth/endpoints";
import { fetchSession } from "@/lib/auth/session";
import type { Account } from "@/types/account";
import type { ApiResource } from "@/types/api";

/** One browser: a persona cookie and a decisions cookie that every call reads and may write, like the real ones. */
function browser(start: string) {
  const jar: Record<string, string | null> = { [MOCK_PERSONA_COOKIE]: start, [MOCK_DECISIONS_COOKIE]: null };
  const client = createApiClient(
    createMockTransport({
      readCookie: (name) => jar[name] ?? null,
      writePersona: (persona) => {
        jar[MOCK_PERSONA_COOKIE] = persona;
      },
      writeDecisions: (encoded) => {
        jar[MOCK_DECISIONS_COOKIE] = encoded;
      },
      latencyMs: 0,
    }),
  );
  const signInAs = async (email: string): Promise<Account> => {
    await client.post(AUTH_ENDPOINTS.signOut);
    const response = await client.post<ApiResource<Account>>(AUTH_ENDPOINTS.signIn, { email, password: MOCK_PASSWORD });
    return response.data;
  };
  return { client, signInAs, jar };
}

const admin = () => browser("admin");

const KULIT = 4;
const CARLA = 5;
const BEA = 8;
const RICO = 102;

const HUMAN_FORM = {
  full_name: "Bea Navarro",
  birthdate: "1997-06-30",
  contact_number: "09170000018",
  city: "Quezon City",
  province: "Metro Manila",
  street_address: "5 Ilang-Ilang St",
  id_type: "drivers_license",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function everyone(client: ApiClient) {
  return (await getVerificationQueue(client, { perPage: 50 })).data;
}

describe("mock admin verification: who may use it (SEC-AUTHZ-01, SEC-AUTHZ-07)", () => {
  const calls: Array<(client: ApiClient) => Promise<unknown>> = [
    (client) => getVerificationQueue(client),
    (client) => getVerificationReview(client, KULIT),
    (client) => getVerificationDocument(client, KULIT, 41),
    (client) => approveVerification(client, KULIT),
    (client) => denyVerification(client, KULIT, { denial_reason: "id_expired", message_to_owner: null }),
  ];

  it("answers 401 to a signed-out visitor", async () => {
    for (const call of calls) await expect(call(browser("signed-out").client)).rejects.toMatchObject({ kind: "unauthenticated" });
  });

  it("answers 403 to pets and humans", async () => {
    for (const persona of ["pet", "human"]) {
      for (const call of calls) await expect(call(browser(persona).client)).rejects.toMatchObject({ kind: "forbidden", status: 403 });
    }
  });

  it("answers 403 account_not_active to an account that isn't Active", async () => {
    for (const call of calls) await expect(call(browser("pet-pending").client)).rejects.toMatchObject({ kind: "account_not_active" });
  });

  it("leaves the queue untouched after every refusal", async () => {
    const pet = browser("pet");
    await approveVerification(pet.client, KULIT).catch(() => undefined);
    expect(pet.jar[MOCK_DECISIONS_COOKIE]).toBeNull();
  });
});

describe("mock verification queue (AU-22)", () => {
  it("lists every waiting account, newest first, a page at a time", async () => {
    const { client } = admin();
    const first = await getVerificationQueue(client);
    expect(first.meta).toMatchObject({ current_page: 1, last_page: 2, per_page: 20, total: 23 });
    expect(first.data).toHaveLength(20);
    expect(first.data[0]).toMatchObject({ account_id: CARLA, role: "human", display_name: "Carla Mendoza", caretaker_name: null });

    const second = await getVerificationQueue(client, { page: 2 });
    expect(second.data).toHaveLength(3);
    expect(second.data[2]).toMatchObject({ account_id: KULIT, role: "pet", display_name: "Kulit", caretaker_name: "Joy Lim" });

    const sent = [...first.data, ...second.data].map((item) => Date.parse(item.submitted_at));
    expect(sent).toEqual([...sent].sort((a, b) => b - a));
    await expect(getVerificationQueueSize(client)).resolves.toBe(23);
  });

  it("filters by account type", async () => {
    const { client } = admin();
    const pets = await getVerificationQueue(client, { role: "pet", perPage: 50 });
    const humans = await getVerificationQueue(client, { role: "human", perPage: 50 });
    expect(pets.data.every((item) => item.role === "pet" && item.caretaker_name)).toBe(true);
    expect(humans.data.every((item) => item.role === "human" && item.caretaker_name === null)).toBe(true);
    expect(pets.meta.total + humans.meta.total).toBe(23);
  });

  it("refuses a type that isn't on the list (SEC-INPUT-03)", async () => {
    const { client } = admin();
    await expect(client.get("/admin/verifications", { query: { role: "admin" } })).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { role: "Choose Pet or Human." },
    });
  });

  it("searches the account's name and the caretaker's, whatever the case", async () => {
    const { client } = admin();
    const byName = await getVerificationQueue(client, { search: "  carLA " });
    expect(byName.data.map((item) => item.display_name)).toEqual(["Carla Mendoza"]);
    const byCaretaker = await getVerificationQueue(client, { search: "joy lim" });
    expect(byCaretaker.data.map((item) => item.display_name)).toEqual(["Kulit"]);
    await expect(getVerificationQueue(client, { search: "nobody by this name" })).resolves.toMatchObject({ data: [], meta: { total: 0 } });
    await expect(getVerificationQueue(client, { search: "x".repeat(101) })).rejects.toMatchObject({ kind: "validation" });
  });

  it("marks resubmissions and describes the documents without linking them (SEC-PRIV-01)", async () => {
    const all = await everyone(admin().client);
    expect(all.filter((item) => item.is_resubmission).map((item) => item.display_name)).toEqual(["Carla Mendoza", "Rico Dela Paz"]);
    for (const item of all) {
      expect(item.documents.length).toBeGreaterThan(0);
      for (const document of item.documents) {
        expect(Object.keys(document).sort()).toEqual(["document_type", "id_type", "mime_type", "size_bytes", "uploaded_at"]);
      }
    }
  });
});

describe("mock verification review (AU-23, AU-24)", () => {
  it("gives a pet's details, documents and place in the queue", async () => {
    const review = await getVerificationReview(admin().client, KULIT);
    expect(review).toMatchObject({
      account_id: KULIT,
      display_name: "Kulit",
      account_status: "pending_verification",
      status: "pending",
      is_resubmission: false,
      previous_denial: null,
      reviewed_at: null,
      reviewed_by: null,
      details: { role: "pet", name: "Kulit", caretaker_name: "Joy Lim", caretaker_contact_number: "09170000014" },
      // The oldest account is last, and points back to the newest.
      queue: { position: 23, total: 23, next_account_id: CARLA },
    });
    expect(review.documents.map((document) => [document.id, document.document_type])).toEqual([
      [41, "valid_id"],
      [42, "pet_photo"],
      [43, "pet_photo"],
      [44, "vet_record_or_certificate"],
    ]);
  });

  it("shows the earlier denial on a resubmission, and never the street address (SEC-PRIV-04)", async () => {
    const review = await getVerificationReview(admin().client, CARLA);
    expect(review).toMatchObject({
      is_resubmission: true,
      previous_denial: { denial_reason: "id_photo_unreadable", message_to_owner: expect.stringContaining("blurry") },
      details: { role: "human", full_name: "Carla Mendoza", birthdate: "1994-11-22", city: "Pasig" },
      queue: { position: 1 },
    });
    expect(review.details).not.toHaveProperty("street_address");
    expect(review.details).not.toHaveProperty("documents");
  });

  it("answers 404 for an account with nothing to review, and for an id that isn't one", async () => {
    const { client } = admin();
    await expect(getVerificationReview(client, 1)).rejects.toMatchObject({ kind: "not_found" });
    await expect(getVerificationReview(client, 99999)).rejects.toMatchObject({ kind: "not_found" });
    await expect(client.get("/admin/verifications/abc")).rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("mock verification documents (SEC-PRIV-01, SEC-FE-09)", () => {
  it("serves an image and a PDF as files of the types the viewer accepts", async () => {
    const { client } = admin();
    const image = await getVerificationDocument(client, KULIT, 41);
    expect(image.type).toBe("image/png");
    expect([...new Uint8Array(await image.arrayBuffer()).subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const record = await getVerificationDocument(client, KULIT, 44);
    expect(record.type).toBe("application/pdf");
    const text = await record.text();
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    // The cross-reference table points at each object.
    const start = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(start, start + 4)).toBe("xref");
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n /gm)].map((match) => Number(match[1]));
    offsets.forEach((offset, index) => expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true));
  });

  it("draws different pet photos", async () => {
    const { client } = admin();
    const [first, second] = await Promise.all([getVerificationDocument(client, KULIT, 42), getVerificationDocument(client, KULIT, 43)]);
    expect(Buffer.from(await first.arrayBuffer()).equals(Buffer.from(await second.arrayBuffer()))).toBe(false);
  });

  it("answers 404 for a document of another account, like a missing one (SEC-AUTHZ-04)", async () => {
    const { client } = admin();
    await expect(getVerificationDocument(client, BEA, 41)).rejects.toMatchObject({ kind: "not_found" });
    await expect(getVerificationDocument(client, KULIT, 49)).rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("mock approve (AU-26, FR33)", () => {
  it("makes the account Active, takes it off the queue and lets its owner into the member shell", async () => {
    const { client, signInAs } = admin();
    const review = await approveVerification(client, KULIT);
    expect(review).toMatchObject({
      status: "approved",
      account_status: "active",
      reviewed_by: "admin.jess",
      denial_reason: null,
      queue: { position: null, total: 22, next_account_id: CARLA },
    });
    expect(Date.parse(review.reviewed_at ?? "")).not.toBeNaN();

    expect((await everyone(client)).map((item) => item.account_id)).not.toContain(KULIT);
    await expect(getVerificationQueueSize(client)).resolves.toBe(22);
    await expect(getVerificationReview(client, KULIT)).resolves.toMatchObject({ status: "approved", reviewed_by: "admin.jess" });

    await expect(signInAs("kulit@example.com")).resolves.toMatchObject({ id: KULIT, status: "active" });
    await expect(fetchSession(client)).resolves.toMatchObject({ id: KULIT, status: "active" });
    await expect(getAccountStatus(client)).resolves.toMatchObject({ status: "active", denial_reason: null, reason: null });
    // An Active member passes the gate that stopped it while Pending (SEC-AUTHZ-06).
    await expect(client.get("/adoption-requests")).resolves.toMatchObject({ data: expect.any(Array) });
  });

  it("answers 409 when the account was already decided", async () => {
    const { client } = admin();
    await approveVerification(client, KULIT);
    for (const again of [() => approveVerification(client, KULIT), () => denyVerification(client, KULIT, { denial_reason: "other", message_to_owner: "Too late." })]) {
      await expect(again()).rejects.toMatchObject({
        kind: "conflict",
        code: ALREADY_REVIEWED_CODE,
        message: "This account was already approved by admin.jess.",
      });
    }
  });

  it("answers 404 for an account that isn't in review", async () => {
    await expect(approveVerification(admin().client, 1)).rejects.toMatchObject({ kind: "not_found" });
  });
});

describe("mock deny (AU-25, AU-20)", () => {
  it("needs a reason, and a message when the reason is Other (SEC-AUTHZ-07, SEC-INPUT-05)", async () => {
    const { client, jar } = admin();
    await expect(client.post("/admin/verifications/8/deny", {})).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { denial_reason: "Choose a reason." },
    });
    await expect(client.post("/admin/verifications/8/deny", { denial_reason: "because" })).rejects.toMatchObject({
      fieldErrors: { denial_reason: "Choose a reason." },
    });
    await expect(denyVerification(client, BEA, { denial_reason: "other", message_to_owner: "   " })).rejects.toMatchObject({
      fieldErrors: { message_to_owner: "Write a message so the owner knows what to correct." },
    });
    await expect(denyVerification(client, BEA, { denial_reason: "id_expired", message_to_owner: "x".repeat(501) })).rejects.toMatchObject({
      fieldErrors: { message_to_owner: "Keep the message to 500 characters or fewer." },
    });
    expect(jar[MOCK_DECISIONS_COOKIE]).toBeNull();
    await expect(getVerificationReview(client, BEA)).resolves.toMatchObject({ status: "pending" });
  });

  it("shows the owner the admin's reason, and takes the account back when they resubmit", async () => {
    const { client, signInAs } = admin();
    const denied = await denyVerification(client, BEA, { denial_reason: "name_mismatch", message_to_owner: "  The ID says Beatriz.  " });
    expect(denied).toMatchObject({
      status: "denied",
      account_status: "denied",
      denial_reason: "name_mismatch",
      message_to_owner: "The ID says Beatriz.",
      reviewed_by: "admin.jess",
      queue: { position: null, total: 22 },
    });

    await expect(signInAs("bea.navarro@example.com")).resolves.toMatchObject({ id: BEA, status: "denied" });
    await expect(getAccountStatus(client)).resolves.toMatchObject({
      status: "denied",
      denial_reason: "name_mismatch",
      reason: "The ID says Beatriz.",
    });

    await expect(updateSubmission(client, form(HUMAN_FORM))).resolves.toMatchObject({ id: BEA, status: "pending_verification" });
    await expect(getAccountStatus(client)).resolves.toMatchObject({ status: "pending_verification", is_resubmission: true, reason: null });

    await signInAs("admin@example.com");
    const again = await getVerificationReview(client, BEA);
    expect(again).toMatchObject({
      status: "pending",
      is_resubmission: true,
      previous_denial: { denial_reason: "name_mismatch", message_to_owner: "The ID says Beatriz." },
      // Sent again just now: the newest submission goes to the back of the queue.
      queue: { position: 1, total: 23 },
    });
    await expect(approveVerification(client, BEA)).resolves.toMatchObject({ status: "approved", account_status: "active" });
  });

  it("accepts a reason without a message, and keeps a denial that replaces an earlier one", async () => {
    const { client, signInAs } = admin();
    await expect(denyVerification(client, CARLA, { denial_reason: "id_expired", message_to_owner: null })).resolves.toMatchObject({
      status: "denied",
      message_to_owner: null,
      previous_denial: { denial_reason: "id_photo_unreadable" },
    });
    await signInAs("carla.mendoza@example.com");
    await expect(getAccountStatus(client)).resolves.toMatchObject({ status: "denied", denial_reason: "id_expired", reason: null });
  });

  it("ignores a status or a reviewer sent in the body (SEC-INPUT-04)", async () => {
    const { client } = admin();
    const body = { denial_reason: "id_expired", message_to_owner: null, status: "approved", account_status: "active", reviewed_by: "someone.else" };
    await expect(client.post<ApiResource<unknown>>(`/admin/verifications/${RICO}/deny`, body)).resolves.toMatchObject({
      data: { status: "denied", account_status: "denied", reviewed_by: "admin.jess" },
    });
  });
});

describe("mock decisions cookie", () => {
  const at = "2026-10-04T02:00:00.000Z";

  it("survives the trip through the cookie", () => {
    const decisions = {
      4: { status: "approved" as const, at, by: "admin.jess" },
      8: { status: "denied" as const, at, by: "admin.jess", reason: "other" as const, message: "Say “hi”; 100% & more" },
    };
    expect(parseMockDecisions(encodeMockDecisions(decisions))).toEqual(decisions);
  });

  it("ignores a cookie that isn't decisions", () => {
    for (const cookie of [null, "", "not json", "[]", '"text"', '{"4":{"status":"active"}}', '{"x":{"status":"approved","at":"a","by":"b"}}']) {
      expect(parseMockDecisions(cookie)).toEqual({});
    }
    expect(parseMockDecisions('{"8":{"status":"denied","at":"a","by":"b","reason":"nonsense"}}')).toEqual({});
  });

  it("stays inside a cookie's size by dropping the oldest decisions", () => {
    const many = Object.fromEntries(
      Array.from({ length: 30 }, (_, n) => [
        200 - n,
        { status: "denied" as const, at: new Date(Date.parse(at) + n * 60_000).toISOString(), by: "admin.jess", reason: "other" as const, message: "é".repeat(500) },
      ]),
    );
    const encoded = encodeMockDecisions(many);
    expect(encodeURIComponent(encoded).length).toBeLessThanOrEqual(3000);
    const kept = parseMockDecisions(encoded);
    // The newest decision is account 171 (n = 29); the oldest, account 200, made way.
    expect(kept[171]?.message).toHaveLength(300);
    expect(kept[200]).toBeUndefined();
  });

  it("never changes an admin, and leaves accounts without a decision alone", () => {
    const decisions = { 3: { status: "denied" as const, at, by: "x", reason: "other" as const }, 4: { status: "approved" as const, at, by: "x" } };
    expect(withMockDecision(MOCK_PERSONAS.admin, decisions)).toBe(MOCK_PERSONAS.admin);
    expect(withMockDecision(MOCK_PERSONAS.pet, decisions)).toBe(MOCK_PERSONAS.pet);
    expect(withMockDecision(MOCK_PERSONAS["pet-pending"], decisions)).toMatchObject({ id: 4, status: "active" });
    expect(withMockDecision(null, decisions)).toBeNull();
  });
});
