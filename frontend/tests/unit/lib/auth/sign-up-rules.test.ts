import { describe, expect, it } from "vitest";
import { PROVINCES } from "@/constants/provinces";
import {
  ageOn,
  approximateAgeProblem,
  birthdateProblem,
  contactNumberProblem,
  normalizeContactNumber,
} from "@/lib/auth/sign-up-rules";

const TODAY = new Date(2026, 9, 3); // 3 October 2026

describe("sign-up rules", () => {
  it("reads Philippine mobile numbers however they are written", () => {
    expect(normalizeContactNumber("0917 123 4567")).toBe("09171234567");
    expect(normalizeContactNumber("0917-123-4567")).toBe("09171234567");
    expect(normalizeContactNumber("+63 917 123 4567")).toBe("09171234567");
    expect(normalizeContactNumber("639171234567")).toBe("09171234567");
    expect(normalizeContactNumber("0917 123 456")).toBeNull();
    expect(normalizeContactNumber("0287 123 4567")).toBeNull();
    expect(contactNumberProblem("  ")).toBe("Enter a mobile number.");
    expect(contactNumberProblem("12345")).toBe("Enter a mobile number like 0917 123 4567.");
    expect(contactNumberProblem("0917 123 4567")).toBeNull();
  });

  it("counts full years, turning a year older on the birthday", () => {
    expect(ageOn("2008-10-03", TODAY)).toBe(18);
    expect(ageOn("2008-10-04", TODAY)).toBe(17);
    expect(ageOn("1990-03-04", TODAY)).toBe(36);
    expect(ageOn("2026-02-31", TODAY)).toBeNull();
    expect(ageOn("03/04/1990", TODAY)).toBeNull();
  });

  it("lets only adults continue (proposal §5.1)", () => {
    expect(birthdateProblem("", TODAY)).toBe("Enter your birthdate.");
    expect(birthdateProblem("2008-10-04", TODAY)).toBe("You must be 18 or older to adopt on Pawfolio.");
    expect(birthdateProblem("2008-10-03", TODAY)).toBeNull();
    expect(birthdateProblem("2027-01-01", TODAY)).toBe("Enter a valid birthdate.");
    expect(birthdateProblem("0190-01-01", TODAY)).toBe("Enter a valid birthdate.");
  });

  it("accepts a pet's age from 1 month to 30 years", () => {
    expect(approximateAgeProblem(null)).toBe("Enter the pet's approximate age.");
    expect(approximateAgeProblem(0)).toMatch(/whole number/);
    expect(approximateAgeProblem(1.5)).toMatch(/whole number/);
    expect(approximateAgeProblem(1)).toBeNull();
    expect(approximateAgeProblem(360)).toBeNull();
    expect(approximateAgeProblem(361)).toBe("Enter an age of 30 years or less.");
  });

  it("lists every province once, in alphabetical order, with Metro Manila", () => {
    expect(PROVINCES).toHaveLength(83);
    expect(new Set(PROVINCES).size).toBe(83);
    expect([...PROVINCES].sort((a, b) => a.localeCompare(b, "en"))).toEqual([...PROVINCES]);
    expect(PROVINCES).toContain("Metro Manila");
  });
});
