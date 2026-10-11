import { describe, expect, it } from "vitest";
import { householdSummary, otherPetsSummary, preferredPetSummary } from "@/constants/home-profiles";
import {
  MATCH_WEIGHTS,
  QUIZ_REVIEW_STEP,
  QUIZ_STEP_FIELDS,
  QUIZ_STEPS,
  type QuizValues,
  firstOpenQuizStep,
  profileChecklist,
  quizDraftPayload,
  quizFieldErrors,
  quizStepFromParam,
  quizStepPayload,
  quizStepsDone,
  quizValuesFrom,
  sameAnswers,
  validateIntro,
  validateQuizStep,
} from "@/features/profiles/schemas/home-profile-schemas";
import type { OwnHomeProfile } from "@/features/profiles/types/own-home-profile";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";

const own = (index: number, extra: Partial<OwnHomeProfile> = {}): OwnHomeProfile => ({
  ...HOME_PROFILES[index],
  province: "Metro Manila",
  views_count: 0,
  open_slots_count: 0,
  ...extra,
});

const ANA = own(0);
const NEW_HOME = own(1);

const FILLED: QuizValues = quizValuesFrom(ANA);
const EMPTY: QuizValues = quizValuesFrom(NEW_HOME);

describe("quizValuesFrom", () => {
  it("turns answers that aren't given yet into empty strings and keeps the lists", () => {
    expect(EMPTY).toMatchObject({ home_type: "", hours_away: "", about_home: "", household_members: [], city: "Pasig", province: "Metro Manila" });
    expect(FILLED).toMatchObject({ home_type: "condo", hours_away: "3_to_5", other_pets: ["cats"], accepted_species: ["dog", "cat"] });
  });
});

describe("validateQuizStep", () => {
  it("finds nothing wrong with a quiz that is filled in", () => {
    QUIZ_STEPS.forEach((_, step) => expect(validateQuizStep(step, FILLED, true)).toEqual({}));
  });

  it("asks for every answer the match uses before a step is left", () => {
    expect(Object.keys(validateQuizStep(0, EMPTY, true))).toEqual(["household_members"]);
    expect(Object.keys(validateQuizStep(1, EMPTY, true))).toEqual(["home_type", "outdoor_space"]);
    expect(Object.keys(validateQuizStep(2, EMPTY, true))).toEqual(["activity_level", "hours_away"]);
    expect(Object.keys(validateQuizStep(3, EMPTY, true))).toEqual(["pet_experience", "special_needs_willingness"]);
    expect(Object.keys(validateQuizStep(4, EMPTY, true))).toEqual(["accepted_species"]);
  });

  it("lets other pets, size, age and the about text stay open", () => {
    const values: QuizValues = { ...FILLED, other_pets: [], preferred_sizes: [], preferred_ages: [], about_home: "" };
    expect(validateQuizStep(0, values, true)).toEqual({});
    expect(validateQuizStep(4, values, true)).toEqual({});
  });

  it("lets a draft stop halfway, but never without a city and a province", () => {
    expect(validateQuizStep(0, EMPTY, false)).toEqual({});
    expect(validateQuizStep(1, EMPTY, false)).toEqual({});
    expect(Object.keys(validateQuizStep(1, { ...EMPTY, city: "  ", province: "Atlantis" }, false))).toEqual(["city", "province"]);
  });

  it("keeps the about text within its limit", () => {
    expect(validateQuizStep(0, { ...FILLED, about_home: "a".repeat(1000) }, true)).toEqual({});
    expect(validateQuizStep(0, { ...FILLED, about_home: "a".repeat(1001) }, true)).toHaveProperty("about_home");
  });

  it("checks nothing on the review step", () => {
    expect(validateQuizStep(QUIZ_REVIEW_STEP, EMPTY, true)).toEqual({});
  });
});

describe("quizStepPayload", () => {
  it("sends exactly the fields of the step, as the API names them", () => {
    QUIZ_STEP_FIELDS.forEach((fields, step) => expect(Object.keys(quizStepPayload(step, FILLED))).toEqual([...fields]));
  });

  it("trims text, clears an empty about text, and sends no other pets as an empty list", () => {
    expect(quizStepPayload(0, { ...FILLED, other_pets: [], about_home: "   " })).toEqual({ household_members: ["just_me"], other_pets: [], about_home: null });
    expect(quizStepPayload(1, { ...FILLED, city: "  Quezon City " })).toMatchObject({ city: "Quezon City", province: "Metro Manila" });
  });

  it("never sends a status, a role or Open to Adopt", () => {
    const sent = QUIZ_STEPS.flatMap((_, step) => Object.keys(quizStepPayload(step, FILLED)));
    expect(sent).not.toContain("is_open_to_adopt");
    expect(sent).not.toContain("status");
    expect(sent).not.toContain("full_name");
  });
});

describe("quizDraftPayload", () => {
  it("leaves out required questions that aren't answered, which the API would refuse", () => {
    expect(quizDraftPayload(0, EMPTY)).toEqual({ other_pets: [], about_home: null });
    expect(quizDraftPayload(1, EMPTY)).toEqual({ city: "Pasig", province: "Metro Manila" });
    expect(quizDraftPayload(2, { ...EMPTY, activity_level: "active" })).toEqual({ activity_level: "active" });
    expect(quizDraftPayload(4, EMPTY)).toEqual({ preferred_sizes: [], preferred_ages: [] });
  });

  it("is the whole step once everything is answered", () => {
    QUIZ_STEPS.forEach((_, step) => expect(quizDraftPayload(step, FILLED)).toEqual(quizStepPayload(step, FILLED)));
  });
});

describe("sameAnswers", () => {
  it("reads a list as a set, because the API may return it in another order", () => {
    expect(sameAnswers({ accepted_species: ["dog", "cat"], home_type: "house" }, { accepted_species: ["cat", "dog"], home_type: "house" })).toBe(true);
    expect(sameAnswers(FILLED, { ...FILLED, preferred_sizes: ["medium", "small"] })).toBe(true);
  });

  it("sees a changed answer, a new item and a cleared list", () => {
    expect(sameAnswers(FILLED, { ...FILLED, home_type: "house" })).toBe(false);
    expect(sameAnswers(FILLED, { ...FILLED, accepted_species: ["dog", "cat", "other"] })).toBe(false);
    expect(sameAnswers(FILLED, { ...FILLED, other_pets: [] })).toBe(false);
  });
});

describe("quizStepsDone and firstOpenQuizStep", () => {
  it("opens the first step for a home that has answered nothing", () => {
    expect(quizStepsDone(NEW_HOME)).toEqual([false, false, false, false, false]);
    expect(firstOpenQuizStep(NEW_HOME)).toBe(0);
  });

  it("opens the first step with a missing answer", () => {
    const half = own(0, { hours_away: null, accepted_species: [] });
    expect(quizStepsDone(half)).toEqual([true, true, false, true, false]);
    expect(firstOpenQuizStep(half)).toBe(2);
  });

  it("opens the review step when every question is answered", () => {
    expect(quizStepsDone(ANA)).toEqual([true, true, true, true, true]);
    expect(firstOpenQuizStep(ANA)).toBe(QUIZ_REVIEW_STEP);
  });
});

describe("quizStepFromParam", () => {
  it("reads steps 1 to 6 and refuses anything else", () => {
    expect(quizStepFromParam("1")).toBe(0);
    expect(quizStepFromParam(["6", "2"])).toBe(5);
    for (const bad of ["0", "7", "2.5", "abc", "", undefined]) expect(quizStepFromParam(bad)).toBeNull();
  });
});

describe("quizFieldErrors", () => {
  it("puts an error on one list item under the question it belongs to", () => {
    expect(quizFieldErrors({ "household_members.0": "Not a choice.", home_type: "Choose one." })).toEqual({
      household_members: "Not a choice.",
      home_type: "Choose one.",
    });
  });
});

describe("MATCH_WEIGHTS", () => {
  it("adds up to 100 points, weighted as the proposal says", () => {
    expect(MATCH_WEIGHTS.map((weight) => weight.points)).toEqual([20, 15, 15, 15, 15, 10, 10]);
    expect(MATCH_WEIGHTS.reduce((sum, weight) => sum + weight.points, 0)).toBe(100);
  });

  it("points each weight at a question step", () => {
    for (const weight of MATCH_WEIGHTS) expect(weight.step).toBeLessThan(QUIZ_REVIEW_STEP);
  });
});

describe("validateIntro", () => {
  it("accepts empty texts and texts within the limits", () => {
    expect(validateIntro({ headline: "", about_home: "" })).toEqual({});
    expect(validateIntro({ headline: "a".repeat(140), about_home: "a".repeat(1000) })).toEqual({});
  });

  it("refuses texts over the limits", () => {
    expect(Object.keys(validateIntro({ headline: "a".repeat(141), about_home: "a".repeat(1001) }))).toEqual(["headline", "about_home"]);
  });
});

describe("profileChecklist", () => {
  it("ticks what is there and leaves the rest open", () => {
    expect(profileChecklist(own(0, { open_slots_count: 3 }))).toEqual([
      { key: "intro", done: true },
      { key: "quiz", done: true },
      { key: "slots", done: true },
      { key: "photo", done: false },
    ]);
    expect(profileChecklist(NEW_HOME).every((item) => !item.done)).toBe(true);
  });
});

describe("Home Profile summaries", () => {
  it("lists the household in the order of the options, as one phrase", () => {
    expect(householdSummary({ household_members: ["kids_6_to_12", "partner"] })).toBe("Partner, kids 6–12");
    expect(householdSummary({ household_members: ["just_me"] })).toBe("Just me");
    expect(householdSummary({ household_members: [] })).toBeNull();
  });

  it("reads no other pets as None", () => {
    expect(otherPetsSummary({ other_pets: [] })).toBe("None");
    expect(otherPetsSummary({ other_pets: ["cats", "dogs"] })).toBe("Dog(s), cat(s)");
  });

  it("says what pet the home is looking for, with open sizes and ages as any", () => {
    expect(preferredPetSummary(ANA)).toBe("Dog or cat · small or medium · adult");
    expect(preferredPetSummary({ accepted_species: ["dog"], preferred_sizes: [], preferred_ages: [] })).toBe("Dog · any size · any age");
    expect(preferredPetSummary({ accepted_species: ["other", "cat", "dog"], preferred_sizes: ["large", "small", "medium"], preferred_ages: ["senior", "puppy_kitten"] })).toBe(
      "Dog, cat or other · small, medium or large · puppy/kitten or senior",
    );
    expect(preferredPetSummary({ accepted_species: [], preferred_sizes: ["small"], preferred_ages: [] })).toBeNull();
  });
});
