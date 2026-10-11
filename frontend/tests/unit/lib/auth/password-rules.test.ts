import { describe, expect, it } from "vitest";
import { PASSWORD_RULES, firstPasswordProblem, passwordStrength } from "@/lib/auth/password-rules";

describe("password rules (SEC-AUTH-03, AU-06)", () => {
  it("are 8+ characters, a letter and a number, in that order", () => {
    expect(PASSWORD_RULES.map((rule) => rule.id)).toEqual(["length", "letter", "number"]);
    expect(firstPasswordProblem("abc1")).toBe("Use at least 8 characters.");
    expect(firstPasswordProblem("abcdefgh")).toBe("Include at least one number.");
    expect(firstPasswordProblem("12345678")).toBe("Include at least one letter.");
    expect(firstPasswordProblem("ñandú2026")).toBeNull();
  });

  it("rates strength by length and variety, and never calls a too-short password strong", () => {
    expect(passwordStrength("")).toEqual({ score: 0, label: "Too short" });
    expect(passwordStrength("Ab1!xyz")).toEqual({ score: 0, label: "Too short" });
    expect(passwordStrength("abcdefg1").label).toBe("Weak");
    expect(passwordStrength("Abcdefg1").label).toBe("Fair");
    expect(passwordStrength("Abcdefg1!").label).toBe("Good");
    expect(passwordStrength("Abcdefg1!long-one").label).toBe("Strong");
  });
});
