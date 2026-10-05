import { describe, expect, it } from "vitest";
import {
  PHOTOS_STEP,
  REVIEW_STEP,
  type ResumeValues,
  cropRect,
  firstOpenStep,
  movePhoto,
  resumeFieldErrors,
  resumeStepPayload,
  resumeValuesFrom,
  stepFromParam,
  validateResumeStep,
} from "@/features/profiles/schemas/resume-schemas";
import type { ResumeCompleteness } from "@/features/profiles/types/own-pet";
import { PETS } from "@/lib/api/mock/fixtures/pets";

const FILLED: ResumeValues = {
  sex: "female",
  size: "medium",
  currently_at: "Happy Paws Rescue (foster home)",
  city: "Quezon City",
  province: "Metro Manila",
  bio: "Hi, I'm Mochi! I was found near a jeepney terminal and now I'm fostered by Happy Paws.",
  temperament_tags: ["Playful", "Loyal"],
  energy_level: "high",
  skills: ["sit_and_stay"],
  good_with_kids: "yes",
  good_with_dogs: "yes",
  good_with_cats: "unknown",
  time_alone: "up_to_6_hrs",
  space_needs: "needs_yard_or_daily_walks",
  experience_needed: "first_time_ok",
  health_notes: "Fully vaccinated, dewormed, spayed.",
  special_needs: [],
};

const EMPTY: ResumeValues = {
  ...FILLED,
  sex: "",
  size: "",
  bio: "",
  temperament_tags: [],
  energy_level: "",
  skills: [],
  good_with_kids: "",
  good_with_dogs: "",
  good_with_cats: "",
  time_alone: "",
  space_needs: "",
  experience_needed: "",
  health_notes: "",
};

const completeness = (open: Partial<ResumeCompleteness["steps"]> = {}): ResumeCompleteness => {
  const steps = { basics: true, photos: true, about_temperament: true, compatibility: true, health: true, ...open };
  const done = Object.values(steps).filter(Boolean).length;
  return { is_complete: done === 5, strength_percent: done * 20, steps, missing: [] };
};

describe("validateResumeStep", () => {
  it("accepts a filled resume on every step, Draft or published", () => {
    for (let step = 0; step <= REVIEW_STEP; step++) {
      expect(validateResumeStep(step, FILLED, false)).toEqual({});
      expect(validateResumeStep(step, FILLED, true)).toEqual({});
    }
  });

  it("lets a Draft leave questions open", () => {
    for (let step = 0; step <= REVIEW_STEP; step++) expect(validateResumeStep(step, EMPTY, false)).toEqual({});
  });

  it("keeps a published resume complete", () => {
    expect(validateResumeStep(0, EMPTY, true)).toEqual({ sex: "Choose the pet's sex.", size: "Choose a size." });
    expect(Object.keys(validateResumeStep(2, EMPTY, true))).toEqual(["bio", "temperament_tags", "energy_level"]);
    // Skills are never required: not every pet is trained.
    expect(Object.keys(validateResumeStep(3, EMPTY, true))).toEqual([
      "good_with_kids",
      "good_with_dogs",
      "good_with_cats",
      "time_alone",
      "space_needs",
      "experience_needed",
    ]);
    // No special needs is an answer, so only the notes are asked for.
    expect(Object.keys(validateResumeStep(4, EMPTY, true))).toEqual(["health_notes"]);
  });

  it("never lets the place fields go empty, as the API doesn't", () => {
    const values = { ...FILLED, currently_at: "  ", city: "", province: "Atlantis" };
    expect(validateResumeStep(0, values, false)).toEqual({
      currently_at: "Enter where the pet is staying.",
      city: "Enter the city.",
      province: "Choose a province.",
    });
  });

  it("checks what was typed even on a Draft", () => {
    expect(validateResumeStep(2, { ...EMPTY, bio: "Too short" }, false)).toEqual({ bio: "Write at least 50 characters." });
    expect(validateResumeStep(2, { ...FILLED, bio: "a".repeat(601) }, false)).toEqual({ bio: "Keep the bio to 600 characters or fewer." });
    expect(validateResumeStep(2, { ...FILLED, bio: "a".repeat(50) }, true)).toEqual({});
    expect(validateResumeStep(2, { ...FILLED, temperament_tags: ["1", "2", "3", "4", "5", "6"] }, false)).toEqual({
      temperament_tags: "Pick up to 5 tags.",
    });
    expect(validateResumeStep(4, { ...FILLED, health_notes: "a".repeat(2001) }, false)).toEqual({
      health_notes: "Keep the notes to 2000 characters or fewer.",
    });
  });

  it("has nothing to check on the photos and review steps", () => {
    expect(validateResumeStep(PHOTOS_STEP, EMPTY, true)).toEqual({});
    expect(validateResumeStep(REVIEW_STEP, EMPTY, true)).toEqual({});
  });
});

describe("resumeStepPayload", () => {
  it("sends only the step's fields, trimmed, with open questions as null", () => {
    expect(resumeStepPayload(0, { ...FILLED, city: "  Pasig ", sex: "" })).toEqual({
      sex: null,
      size: "medium",
      currently_at: "Happy Paws Rescue (foster home)",
      city: "Pasig",
      province: "Metro Manila",
    });
    expect(resumeStepPayload(2, { ...EMPTY, bio: "   " })).toEqual({ bio: null, temperament_tags: [], energy_level: null });
    expect(resumeStepPayload(4, FILLED)).toEqual({ health_notes: "Fully vaccinated, dewormed, spayed.", special_needs: [] });
  });

  it("never sends the status or the locked fields", () => {
    for (let step = 0; step <= REVIEW_STEP; step++) {
      const keys = Object.keys(resumeStepPayload(step, FILLED));
      for (const forbidden of ["status", "name", "species", "breed", "approximate_age_months"]) expect(keys).not.toContain(forbidden);
    }
    expect(resumeStepPayload(PHOTOS_STEP, FILLED)).toEqual({});
    expect(resumeStepPayload(REVIEW_STEP, FILLED)).toEqual({});
  });
});

describe("resumeValuesFrom", () => {
  it("turns the API's nulls into unanswered questions", () => {
    const draft = PETS.find((pet) => pet.status === "draft") ?? { ...PETS[0], sex: null, bio: null };
    const values = resumeValuesFrom({ ...draft, sex: null, bio: null, energy_level: null });
    expect([values.sex, values.bio, values.energy_level]).toEqual(["", "", ""]);
    expect(resumeValuesFrom(PETS[0]).city).toBe(PETS[0].city);
  });
});

describe("resumeFieldErrors", () => {
  it("puts a list item's error on its field", () => {
    expect(resumeFieldErrors({ "temperament_tags.0": "Too long.", "temperament_tags.2": "Also.", bio: "Short." })).toEqual({
      temperament_tags: "Too long.",
      bio: "Short.",
    });
  });
});

describe("firstOpenStep", () => {
  it("opens the first step with something to do", () => {
    expect(firstOpenStep(completeness({ health: false }))).toBe(4);
    expect(firstOpenStep(completeness({ photos: false, health: false }))).toBe(PHOTOS_STEP);
    expect(firstOpenStep(completeness({ basics: false, compatibility: false }))).toBe(0);
  });

  it("opens the review step when everything is done", () => {
    expect(firstOpenStep(completeness())).toBe(REVIEW_STEP);
  });
});

describe("stepFromParam", () => {
  it("reads ?step= as the 1-based step it shows", () => {
    expect(stepFromParam("1")).toBe(0);
    expect(stepFromParam("6")).toBe(5);
    expect(stepFromParam(["3", "4"])).toBe(2);
  });

  it("ignores anything that isn't a step", () => {
    for (const param of [undefined, "", "0", "7", "2.5", "abc", "-1"]) expect(stepFromParam(param)).toBeNull();
  });
});

describe("movePhoto", () => {
  it("moves a photo and keeps the others in order", () => {
    expect(movePhoto([1, 2, 3, 4], 3, 0)).toEqual([3, 1, 2, 4]);
    expect(movePhoto([1, 2, 3, 4], 1, 1)).toEqual([2, 1, 3, 4]);
    expect(movePhoto([1, 2, 3, 4], 2, 3)).toEqual([1, 3, 4, 2]);
  });

  it("stays inside the list and ignores an unknown photo", () => {
    expect(movePhoto([1, 2, 3], 1, -4)).toEqual([1, 2, 3]);
    expect(movePhoto([1, 2, 3], 1, 99)).toEqual([2, 3, 1]);
    expect(movePhoto([1, 2, 3], 9, 0)).toEqual([1, 2, 3]);
  });
});

describe("cropRect", () => {
  it("keeps the widest 4:3 part of a landscape photo, centred", () => {
    expect(cropRect(1600, 900, 1, 0, 0)).toEqual({ x: 200, y: 0, width: 1200, height: 900 });
  });

  it("keeps the tallest 4:3 part of a portrait photo, centred", () => {
    expect(cropRect(900, 1600, 1, 0, 0)).toEqual({ x: 0, y: 462.5, width: 900, height: 675 });
  });

  it("pans to the edges and no further", () => {
    expect(cropRect(1600, 900, 1, -1, 0).x).toBe(0);
    expect(cropRect(1600, 900, 1, 1, 0).x).toBe(400);
    expect(cropRect(1600, 900, 1, 5, 0).x).toBe(400);
  });

  it("zooms in on the middle and always stays inside the photo", () => {
    expect(cropRect(1200, 900, 2, 0, 0)).toEqual({ x: 300, y: 225, width: 600, height: 450 });
    for (const [zoom, panX, panY] of [[1, -1, -1], [2.5, 1, 1], [4, -1, 1], [9, 1, -1]] as const) {
      const rect = cropRect(1000, 700, zoom, panX, panY);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1000.0001);
      expect(rect.y + rect.height).toBeLessThanOrEqual(700.0001);
      expect(rect.width / rect.height).toBeCloseTo(4 / 3);
    }
  });
});
