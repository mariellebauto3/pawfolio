"use client";

import { ChoiceChips } from "@/components/forms/choice-chips";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import { LockedField } from "@/components/forms/locked-field";
import { Select } from "@/components/forms/select";
import { Textarea } from "@/components/forms/textarea";
import {
  ENERGY_LEVEL_LABELS,
  EXPERIENCE_NEEDED_LABELS,
  GOOD_WITH_LABELS,
  PET_SEX_LABELS,
  PET_SIZE_LABELS,
  PET_SKILL_LABELS,
  SPACE_NEEDS_LABELS,
  SPECIAL_NEED_LABELS,
  SPECIES_LABELS,
  TEMPERAMENT_TAGS,
  TIME_ALONE_LABELS,
  optionsFrom,
} from "@/constants/pets";
import { PROVINCES } from "@/constants/provinces";
import { ROUTES } from "@/constants/routes";
import type { FieldErrors } from "@/lib/api/errors";
import { formatAgeMonths } from "@/lib/utils/format-age";
import type { Pet, PetSkill, PetSpecialNeed } from "@/types/pet";
import { RESUME_LIMITS, type ResumeField, type ResumeValues } from "../schemas/resume-schemas";

// The fields of the edit resume wizard's form steps (PR-03, PR-05, PR-06, PR-07). They hold no state: the wizard
// owns the values and the errors.

export type StepProps = {
  values: ResumeValues;
  errors: FieldErrors;
  set: <F extends ResumeField>(field: F, value: ResumeValues[F]) => void;
};

const GRID = "grid gap-5 md:grid-cols-2";
const NONE = "none";

/** PR-03. The four details an admin verified are locked; a change goes through a request (AC-03). */
export function ResumeBasicsStep({ pet, values, errors, set }: StepProps & { pet: Pet }) {
  return (
    <div className={GRID}>
      <LockedField label="Name" value={pet.name} requestChangeHref={ROUTES.settings} />
      <LockedField label="Species" value={SPECIES_LABELS[pet.species]} requestChangeHref={ROUTES.settings} />
      <LockedField label="Breed" value={pet.breed} requestChangeHref={ROUTES.settings} />
      <LockedField label="Approximate age" value={formatAgeMonths(pet.approximate_age_months)} requestChangeHref={ROUTES.settings} />
      <Field label="Sex" error={errors.sex}>
        <Select
          name="sex"
          value={values.sex}
          onChange={(event) => set("sex", event.target.value as ResumeValues["sex"])}
          options={optionsFrom(PET_SEX_LABELS)}
          placeholder="Choose a sex"
        />
      </Field>
      <Field label="Size" error={errors.size}>
        <Select
          name="size"
          value={values.size}
          onChange={(event) => set("size", event.target.value as ResumeValues["size"])}
          options={optionsFrom(PET_SIZE_LABELS)}
          placeholder="Choose a size"
        />
      </Field>
      <Field label="Currently at" error={errors.currently_at} hint="Shown on your resume, like a current workplace." className="md:col-span-2">
        <Input
          name="currently_at"
          value={values.currently_at}
          onChange={(event) => set("currently_at", event.target.value)}
          maxLength={RESUME_LIMITS.currently_at}
          autoComplete="off"
        />
      </Field>
      <Field label="City" error={errors.city}>
        <Input name="city" value={values.city} onChange={(event) => set("city", event.target.value)} maxLength={RESUME_LIMITS.city} autoComplete="address-level2" />
      </Field>
      <Field label="Province" error={errors.province} hint="Matches are limited to the same province.">
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
  );
}

/** PR-05. Written in the pet's own voice. */
export function ResumeAboutStep({ values, errors, set }: StepProps) {
  // A tag saved before the list was fixed still shows, so it can be kept or dropped.
  const tags = [...TEMPERAMENT_TAGS, ...values.temperament_tags.filter((tag) => !(TEMPERAMENT_TAGS as readonly string[]).includes(tag))];

  return (
    <>
      <Field label="Bio (first person)" error={errors.bio} hint={`Write as the pet. ${RESUME_LIMITS.bioMin} to ${RESUME_LIMITS.bioMax} characters.`}>
        <Textarea
          name="bio"
          rows={6}
          value={values.bio}
          onChange={(event) => set("bio", event.target.value)}
          minLength={RESUME_LIMITS.bioMin}
          maxLength={RESUME_LIMITS.bioMax}
          placeholder="Hi, I'm…"
        />
      </Field>
      <ChoiceChips
        multiple
        name="temperament_tags"
        legend="Temperament tags"
        hint={`Pick up to ${RESUME_LIMITS.temperamentTags}.`}
        error={errors.temperament_tags}
        options={tags}
        value={values.temperament_tags}
        // A sixth tag isn't taken: the five already picked stay.
        onChange={(next) => set("temperament_tags", next.length > RESUME_LIMITS.temperamentTags ? values.temperament_tags : next)}
      />
      <ChoiceChips
        name="energy_level"
        legend="Energy level"
        hint="Matched with how active the home is."
        error={errors.energy_level}
        options={optionsFrom(ENERGY_LEVEL_LABELS)}
        value={values.energy_level}
        onChange={(value) => set("energy_level", value as ResumeValues["energy_level"])}
      />
    </>
  );
}

/** PR-06. The answers matched against the human's quiz. */
export function ResumeSkillsStep({ values, errors, set }: StepProps) {
  const goodWith = [
    ["good_with_kids", "Good with kids"],
    ["good_with_dogs", "Good with dogs"],
    ["good_with_cats", "Good with cats"],
  ] as const;

  return (
    <>
      <ChoiceChips
        multiple
        optional
        name="skills"
        legend="Skills (trained behaviors)"
        error={errors.skills}
        options={optionsFrom(PET_SKILL_LABELS)}
        value={values.skills}
        onChange={(next) => set("skills", next as PetSkill[])}
      />
      <div className={GRID}>
        {goodWith.map(([field, legend]) => (
          <ChoiceChips
            key={field}
            name={field}
            legend={legend}
            error={errors[field]}
            options={optionsFrom(GOOD_WITH_LABELS)}
            value={values[field]}
            onChange={(value) => set(field, value as ResumeValues[typeof field])}
          />
        ))}
        <ChoiceChips
          name="time_alone"
          legend="Can be left alone"
          error={errors.time_alone}
          options={optionsFrom(TIME_ALONE_LABELS)}
          value={values.time_alone}
          onChange={(value) => set("time_alone", value as ResumeValues["time_alone"])}
        />
      </div>
      <p className="text-sm text-ink-muted">A “No” means homes with them aren&apos;t suggested as matches.</p>
      <ChoiceChips
        name="space_needs"
        legend="Space needs"
        error={errors.space_needs}
        options={optionsFrom(SPACE_NEEDS_LABELS)}
        value={values.space_needs}
        onChange={(value) => set("space_needs", value as ResumeValues["space_needs"])}
      />
      <ChoiceChips
        name="experience_needed"
        legend="Owner experience needed"
        error={errors.experience_needed}
        options={optionsFrom(EXPERIENCE_NEEDED_LABELS)}
        value={values.experience_needed}
        onChange={(value) => set("experience_needed", value as ResumeValues["experience_needed"])}
      />
    </>
  );
}

/** PR-07, the part that is saved with the form. The vet record files are added and removed beside it. */
export function ResumeHealthFields({ values, errors, set }: StepProps) {
  return (
    <>
      <Field label="Health & vet notes" error={errors.health_notes} hint="Vaccinations, deworming, spay or neuter status, anything a home should know.">
        <Textarea
          name="health_notes"
          rows={4}
          value={values.health_notes}
          onChange={(event) => set("health_notes", event.target.value)}
          maxLength={RESUME_LIMITS.health_notes}
        />
      </Field>
      <ChoiceChips
        multiple
        name="special_needs"
        legend="Special needs or medical care"
        error={errors.special_needs}
        options={[{ value: NONE, label: "None" }, ...optionsFrom(SPECIAL_NEED_LABELS)]}
        value={values.special_needs.length ? values.special_needs : [NONE]}
        onChange={(next) => {
          // "None" clears the others; picking a need clears "None". No needs is stored as an empty list.
          const pickedNone = next.includes(NONE) && values.special_needs.length > 0;
          set("special_needs", pickedNone ? [] : (next.filter((value) => value !== NONE) as PetSpecialNeed[]));
        }}
      />
    </>
  );
}
