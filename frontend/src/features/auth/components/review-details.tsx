import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { SPECIES_LABELS } from "@/constants/pets";
import { MIN_ADOPTER_AGE, ageOn } from "@/lib/auth/sign-up-rules";
import { formatAgeMonths, formatContactNumber } from "@/lib/auth/verification-review";
import type { HumanReviewDetails, PetReviewDetails, VerificationReview } from "@/types/verification-review";
import { formatBirthdate } from "../schemas/sign-up-schemas";

type Props = {
  details: VerificationReview["details"];
};

type Row = { label: string; value: ReactNode };

function petRows(pet: PetReviewDetails): Row[] {
  return [
    { label: "Pet name", value: pet.name },
    { label: "Species", value: SPECIES_LABELS[pet.species] },
    { label: "Breed", value: pet.breed },
    { label: "Approximate age", value: formatAgeMonths(pet.approximate_age_months) },
    { label: "Staying at", value: `${pet.currently_at}, ${pet.city}, ${pet.province}` },
    { label: "Caretaker", value: pet.caretaker_name },
    { label: "Caretaker's number", value: formatContactNumber(pet.caretaker_contact_number) },
  ];
}

function humanRows(human: HumanReviewDetails, today: Date): Row[] {
  const age = ageOn(human.birthdate, today);
  return [
    { label: "Full name", value: human.full_name },
    {
      label: "Birthdate",
      value: (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {formatBirthdate(human.birthdate) || human.birthdate}
          {age !== null && <span className="text-ink-muted">{age} years old</span>}
          {age !== null &&
            (age >= MIN_ADOPTER_AGE ? (
              <Tag icon={<Icon name="circle-check" />}>{MIN_ADOPTER_AGE} or older</Tag>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-danger">
                <Icon name="triangle-alert" className="size-4 shrink-0" />
                Under {MIN_ADOPTER_AGE}
              </span>
            ))}
        </span>
      ),
    },
    { label: "Contact number", value: formatContactNumber(human.contact_number) },
    { label: "City", value: `${human.city}, ${human.province}` },
  ];
}

// What the owner submitted, to compare with the documents beside it (AU-23, AU-24). Everything here was typed by
// the owner and is rendered as plain text (SEC-FE-01). The age is worked out from the birthdate when the page loads.
export function ReviewDetails({ details }: Props) {
  const rows = details.role === "pet" ? petRows(details) : humanRows(details, new Date());

  return (
    <Card title="Submitted details">
      <dl className="grid gap-x-6 gap-y-3 md:grid-cols-[10rem_1fr]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-sm text-ink-muted md:pt-0.5">{row.label}</dt>
            <dd className="-mt-2.5 break-words md:mt-0">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
