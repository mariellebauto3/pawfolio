import { describe, expect, it } from "vitest";
import { signUpHuman, signUpPet } from "@/features/auth/api/sign-up";
import { createApiClient } from "@/lib/api/core";
import { EMAIL_TAKEN } from "@/lib/api/mock/handlers/sign-up";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";
import { fetchSession } from "@/lib/auth/session";

function client(start = "signed-out") {
  let persona: string | null = start;
  return createApiClient(
    createMockTransport({
      readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null),
      writePersona: (next) => {
        persona = next;
      },
      latencyMs: 0,
    }),
  );
}

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });

function form(fields: Record<string, string | File | File[] | undefined>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) value.forEach((item) => data.append(key, item));
    else if (value !== undefined) data.set(key, value);
  }
  return data;
}

function without<T extends object>(source: T, ...keys: (keyof T)[]): Partial<T> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key as keyof T))) as Partial<T>;
}

const ACCOUNT = { email: "new.caretaker@example.com", password: "mochi2026", password_confirmation: "mochi2026", terms_accepted: "1" };

const PET = {
  ...ACCOUNT,
  name: "Tala",
  species: "dog",
  breed: "Aspin",
  approximate_age_months: "24",
  currently_at: "Foster home",
  city: "Quezon City",
  province: "Metro Manila",
  "photos[]": [file("tala.jpg", "image/jpeg")],
  caretaker_name: "Joy Lim",
  caretaker_contact_number: "09171234567",
  valid_id: file("id.pdf", "application/pdf"),
};

const HUMAN = {
  ...ACCOUNT,
  full_name: "Liza Cruz",
  birthdate: "1990-03-04",
  contact_number: "09171234567",
  city: "Quezon City",
  province: "Metro Manila",
  street_address: "12 Mabini St",
  id_type: "passport",
  valid_id: file("passport.jpg", "image/jpeg"),
};

describe("mock sign-up handlers follow docs/api/auth.md", () => {
  it("creates a pending pet account and signs it in", async () => {
    const api = client();
    await expect(signUpPet(api, form(PET))).resolves.toMatchObject({ role: "pet", status: "pending_verification" });
    await expect(fetchSession(api)).resolves.toMatchObject({ role: "pet", status: "pending_verification" });
  });

  it("creates a pending human account and signs it in", async () => {
    const api = client();
    await expect(signUpHuman(api, form(HUMAN))).resolves.toMatchObject({ role: "human", status: "pending_verification" });
    await expect(fetchSession(api)).resolves.toMatchObject({ role: "human", status: "pending_verification" });
  });

  it("refuses an email that already has an account, and a signed-in visitor", async () => {
    await expect(signUpPet(client(), form({ ...PET, email: " Mochi@example.com " }))).rejects.toMatchObject({
      kind: "validation",
      fieldErrors: { email: EMAIL_TAKEN },
    });
    await expect(signUpHuman(client("pet"), form(HUMAN))).rejects.toMatchObject({ kind: "forbidden", status: 403 });
  });

  it("checks the password rules and the confirmation like reset-password", async () => {
    await expect(signUpHuman(client(), form({ ...HUMAN, password: "letters", password_confirmation: "letters" }))).rejects.toMatchObject({
      fieldErrors: { password: "Use at least 8 characters." },
    });
    await expect(signUpHuman(client(), form({ ...HUMAN, password_confirmation: "other2026" }))).rejects.toMatchObject({
      fieldErrors: { password: "The passwords don't match." },
    });
  });

  it("refuses a human under 18, whatever the client checked (SEC-INPUT-05)", async () => {
    const year = new Date().getFullYear() - 17;
    await expect(signUpHuman(client(), form({ ...HUMAN, birthdate: `${year}-01-01` }))).rejects.toMatchObject({
      fieldErrors: { birthdate: "You must be 18 or older to adopt on Pawfolio." },
    });
  });

  it("needs the ID, a photo and the agreement, and only accepts listed values", async () => {
    const rest = without(PET, "valid_id", "photos[]", "terms_accepted");
    await expect(signUpPet(client(), form({ ...rest, species: "dragon", province: "NCR" }))).rejects.toMatchObject({
      fieldErrors: {
        valid_id: "Upload a photo of the valid ID.",
        photos: "Add at least one clear photo of the pet.",
        species: "Choose a species.",
        province: "Choose a province.",
        terms_accepted: expect.stringContaining("Terms and Community Guidelines"),
      },
    });
    await expect(signUpHuman(client(), form({ ...HUMAN, id_type: "library_card" }))).rejects.toMatchObject({
      fieldErrors: { id_type: "Choose the type of ID." },
    });
  });

  it("refuses wrong file types and files over 5 MB (SEC-FILE-01, SEC-FILE-02)", async () => {
    const photos = [file("tala.jpg", "image/jpeg"), file("tala.pdf", "application/pdf")];
    await expect(signUpPet(client(), form({ ...PET, "photos[]": photos, vet_record: file("vet.svg", "image/svg+xml") }))).rejects.toMatchObject({
      fieldErrors: { "photos.1": "Upload a JPG or PNG photo.", vet_record: "Upload a JPG, PNG or PDF file." },
    });
    await expect(signUpHuman(client(), form({ ...HUMAN, valid_id: file("big.jpg", "image/jpeg", 5 * 1024 * 1024 + 1) }))).rejects.toMatchObject({
      fieldErrors: { valid_id: "Each file must be 5 MB or smaller." },
    });
    const four = Array.from({ length: 4 }, (_, i) => file(`tala-${i}.png`, "image/png"));
    await expect(signUpPet(client(), form({ ...PET, "photos[]": four }))).rejects.toMatchObject({
      fieldErrors: { photos: "Add up to 3 photos." },
    });
  });
});
