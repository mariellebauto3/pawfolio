"use client";

import { ChoiceChips } from "@/components/forms/choice-chips";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { Textarea } from "@/components/forms/textarea";
import {
  ACTIVITY_LEVEL_LABELS,
  AGE_GROUP_LABELS,
  HOME_TYPE_LABELS,
  HOURS_AWAY_LABELS,
  HOUSEHOLD_MEMBER_LABELS,
  OTHER_PET_LABELS,
  OUTDOOR_SPACE_LABELS,
  PET_EXPERIENCE_LABELS,
  SPECIAL_NEEDS_WILLINGNESS_LABELS,
} from "@/constants/home-profiles";
import { PET_SIZE_LABELS, SPECIES_LABELS, optionsFrom } from "@/constants/pets";
import { PROVINCES } from "@/constants/provinces";
import type { FieldErrors } from "@/lib/api/errors";
import type { AgeGroup, HouseholdMember, OtherPet } from "@/types/home-profile";
import type { PetSize, Species } from "@/types/pet";
import { HOME_PROFILE_LIMITS, type QuizField, type QuizValues } from "../schemas/home-profile-schemas";

// The questions of the Home Profile & lifestyle quiz (PR-14…PR-18). They hold no state: the wizard owns the answers
// and the errors. Each hint says what the answer does to the match (proposal §6), so nobody has to guess why it is
// asked.

export type QuizStepProps = {
  values: QuizValues;
  errors: FieldErrors;
  set: <F extends QuizField>(field: F, value: QuizValues[F]) => void;
};

const GRID = "grid gap-5 md:grid-cols-2";
const NONE = "none";

/** PR-14. Kids and other pets decide which pets can be suggested at all. */
export function QuizHouseholdStep({ values, errors, set }: QuizStepProps) {
  return (
    <>
      <ChoiceChips
        multiple
        name="household_members"
        legend="Who lives with you?"
        hint="Pick everyone. Homes with kids 12 or younger aren’t matched with pets that aren’t good with kids."
        error={errors.household_members}
        options={optionsFrom(HOUSEHOLD_MEMBER_LABELS)}
        value={values.household_members}
        onChange={(next) => {
          // "Just me" and the others can't both be true: picking one side clears the other.
          const picked = next as HouseholdMember[];
          const choseJustMe = picked.includes("just_me") && !values.household_members.includes("just_me");
          set("household_members", choseJustMe ? ["just_me"] : picked.length > 1 ? picked.filter((member) => member !== "just_me") : picked);
        }}
      />
      <ChoiceChips
        multiple
        name="other_pets"
        legend="Other pets at home"
        hint="A pet that isn’t good with dogs or with cats isn’t matched with a home that has them."
        error={errors.other_pets}
        options={[{ value: NONE, label: "None" }, ...optionsFrom(OTHER_PET_LABELS)]}
        value={values.other_pets.length ? values.other_pets : [NONE]}
        onChange={(next) => {
          // "None" clears the others; picking a pet clears "None". No other pets is stored as an empty list.
          const pickedNone = next.includes(NONE) && values.other_pets.length > 0;
          set("other_pets", pickedNone ? [] : (next.filter((value) => value !== NONE) as OtherPet[]));
        }}
      />
      <Field label="About your home" optional error={errors.about_home} hint="Shown publicly. Leave out your address and phone number.">
        <Textarea
          name="about_home"
          rows={4}
          value={values.about_home}
          onChange={(event) => set("about_home", event.target.value)}
          maxLength={HOME_PROFILE_LIMITS.about_home}
          placeholder="We are a family of three who spend weekends at the park."
        />
      </Field>
    </>
  );
}

/** PR-15. Home and outdoor space are compared with the space a pet needs; the province limits the matches. */
export function QuizHomeStep({ values, errors, set }: QuizStepProps) {
  return (
    <>
      <ChoiceChips
        name="home_type"
        legend="Home type"
        error={errors.home_type}
        options={optionsFrom(HOME_TYPE_LABELS)}
        value={values.home_type}
        onChange={(value) => set("home_type", value as QuizValues["home_type"])}
      />
      <ChoiceChips
        name="outdoor_space"
        legend="Outdoor space"
        hint="With the home type, worth 15 of the 100 match points."
        error={errors.outdoor_space}
        options={optionsFrom(OUTDOOR_SPACE_LABELS)}
        value={values.outdoor_space}
        onChange={(value) => set("outdoor_space", value as QuizValues["outdoor_space"])}
      />
      <div className={GRID}>
        <Field label="City" error={errors.city} hint="Only your city is shown publicly.">
          <Input name="city" value={values.city} onChange={(event) => set("city", event.target.value)} maxLength={HOME_PROFILE_LIMITS.city} autoComplete="address-level2" />
        </Field>
        <Field label="Province" error={errors.province} hint="Matches are limited to your province.">
          <Select
            name="province"
            value={values.province}
            onChange={(event) => set("province", event.target.value)}
            options={[...PROVINCES]}
            placeholder="Choose a province"
            autoComplete="address-level1"
          />
        </Field>
      </div>
    </>
  );
}

/** PR-16. The two answers with the most weight. */
export function QuizLifestyleStep({ values, errors, set }: QuizStepProps) {
  return (
    <>
      <ChoiceChips
        name="activity_level"
        legend="Activity level"
        hint="Worth 20 of the 100 match points: compared with the pet’s energy level."
        error={errors.activity_level}
        options={optionsFrom(ACTIVITY_LEVEL_LABELS)}
        value={values.activity_level}
        onChange={(value) => set("activity_level", value as QuizValues["activity_level"])}
      />
      <ChoiceChips
        name="hours_away"
        legend="Hours away from home per day"
        hint="Worth 15 points: compared with how long the pet can be left alone."
        error={errors.hours_away}
        options={optionsFrom(HOURS_AWAY_LABELS)}
        value={values.hours_away}
        onChange={(value) => set("hours_away", value as QuizValues["hours_away"])}
      />
    </>
  );
}

/** PR-17. */
export function QuizExperienceStep({ values, errors, set }: QuizStepProps) {
  return (
    <>
      <ChoiceChips
        name="pet_experience"
        legend="Pet experience"
        hint="Worth 15 points: compared with the experience the pet needs."
        error={errors.pet_experience}
        options={optionsFrom(PET_EXPERIENCE_LABELS)}
        value={values.pet_experience}
        onChange={(value) => set("pet_experience", value as QuizValues["pet_experience"])}
      />
      <ChoiceChips
        name="special_needs_willingness"
        legend="Willing to handle special needs?"
        hint="Daily meds, a special diet or mobility support. Worth 10 points."
        error={errors.special_needs_willingness}
        options={optionsFrom(SPECIAL_NEEDS_WILLINGNESS_LABELS)}
        value={values.special_needs_willingness}
        onChange={(value) => set("special_needs_willingness", value as QuizValues["special_needs_willingness"])}
      />
    </>
  );
}

/** PR-18. A species the human doesn't accept is a dealbreaker; size and age only move the score. */
export function QuizPreferencesStep({ values, errors, set }: QuizStepProps) {
  return (
    <>
      <ChoiceChips
        multiple
        name="accepted_species"
        legend="Species you accept"
        hint="A species you don’t pick is never suggested."
        error={errors.accepted_species}
        options={optionsFrom(SPECIES_LABELS)}
        value={values.accepted_species}
        onChange={(next) => set("accepted_species", next as Species[])}
      />
      <ChoiceChips
        multiple
        optional
        name="preferred_sizes"
        legend="Preferred size"
        hint="Leave empty for any size."
        error={errors.preferred_sizes}
        options={optionsFrom(PET_SIZE_LABELS)}
        value={values.preferred_sizes}
        onChange={(next) => set("preferred_sizes", next as PetSize[])}
      />
      <ChoiceChips
        multiple
        optional
        name="preferred_ages"
        legend="Preferred age"
        hint="Leave empty for any age. With size, worth 15 points."
        error={errors.preferred_ages}
        options={optionsFrom(AGE_GROUP_LABELS)}
        value={values.preferred_ages}
        onChange={(next) => set("preferred_ages", next as AgeGroup[])}
      />
    </>
  );
}
