import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ACTIVITY_LEVEL_LABELS,
  HOME_TYPE_LABELS,
  OUTDOOR_SPACE_LABELS,
  PET_EXPERIENCE_LABELS,
  SPECIAL_NEEDS_WILLINGNESS_LABELS,
  hoursAwaySummary,
  householdSummary,
  otherPetsSummary,
  preferredPetSummary,
} from "@/constants/home-profiles";
import { petPath } from "@/constants/routes";
import { formatDate } from "@/lib/utils/format-date";
import type { AdoptedPet, HomeProfile } from "@/types/home-profile";

type Props = {
  home: HomeProfile;
  /** Buttons under the name: the owner's "Edit Home Profile & quiz", a pet's "Apply for this home". */
  actions?: ReactNode;
  /** Above the profile, e.g. the owner's "finish your quiz" banner. */
  notice?: ReactNode;
  /** The right-hand column: the checklist for the owner, the match for a pet. Below the profile on phones. */
  aside?: ReactNode;
  /** The owner sees "Not added yet" where a section is still empty; other viewers only get sections with content. */
  owner?: boolean;
  /** What goes at the end of an adopted pet's row, e.g. the Furparent's "Adoption details" (AL-06). */
  adoptedPetAction?: (adoption: AdoptedPet) => ReactNode;
};

const NOT_ADDED = <p className="text-ink-muted">Not added yet.</p>;
const NOT_ANSWERED = <span className="text-ink-muted">Not answered yet</span>;

type Row = [label: string, value: string | null | undefined];

function Answers({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-sm text-ink-muted">{label}</dt>
          <dd>{value || NOT_ANSWERED}</dd>
        </div>
      ))}
    </dl>
  );
}

// A human's Home Profile as a profile page (PR-11, DS-05): cover, photo, name and badges, then About our home,
// Household & space, Lifestyle, What we're looking for and the adopted pets. The same view for the human and for a
// pet reading it; what each may do comes in through `actions` and `aside`. It shows the city and a household
// summary only: the province, street address and contact number are never part of it (SEC-PRIV-03). Open to Adopt
// and Furparent are read-only badges, and everything the human typed is rendered as plain text (SEC-FE-01).
export function HomeProfileView({ home, actions, notice, aside, owner = false, adoptedPetAction }: Props) {
  const household = householdSummary(home);
  const facts = [home.home_type && HOME_TYPE_LABELS[home.home_type], household].filter(Boolean);
  const show = (hasContent: boolean) => hasContent || owner;

  const space: Row[] = [
    ["Home type", home.home_type && HOME_TYPE_LABELS[home.home_type]],
    ["Outdoor space", home.outdoor_space && OUTDOOR_SPACE_LABELS[home.outdoor_space]],
    ["Household", household],
    // No other pets is an answer too, but only once the household question has been answered.
    ["Other pets", household ? otherPetsSummary(home) : null],
  ];
  const lifestyle: Row[] = [
    ["Activity level", home.activity_level && ACTIVITY_LEVEL_LABELS[home.activity_level]],
    ["Away from home", home.hours_away && hoursAwaySummary(home.hours_away)],
    ["Pet experience", home.pet_experience && PET_EXPERIENCE_LABELS[home.pet_experience]],
  ];
  const lookingFor: Row[] = [
    ["Preferred pet", preferredPetSummary(home)],
    ["Special needs", home.special_needs_willingness && SPECIAL_NEEDS_WILLINGNESS_LABELS[home.special_needs_willingness]],
  ];
  const answered = (rows: Row[]) => rows.some(([, value]) => value);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        {notice}

        <Card padding="none" as="section">
          <Photo
            ratio="cover"
            rounded={false}
            src={home.cover_photo_url ?? undefined}
            alt={home.cover_photo_url ? `${home.full_name}'s cover photo` : "No cover photo yet"}
            sizes="(min-width: 1024px) 800px, 100vw"
            preload
          />
          <div className="flex flex-col gap-4 px-4 pb-5 md:px-5">
            <Avatar
              name={home.full_name}
              src={home.profile_photo_url ?? undefined}
              alt={home.profile_photo_url ? `${home.full_name}'s profile photo` : home.full_name}
              size="xl"
              className="-mt-12 ring-4 ring-surface"
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-3xl">{home.full_name}</h1>
                {home.is_open_to_adopt && <StatusBadge status="Open to Adopt" />}
                {home.is_furparent && <StatusBadge status="Furparent" />}
              </div>
              {home.headline && <p className="text-lg">{home.headline}</p>}
              {facts.length > 0 && <p>{facts.join(" · ")}</p>}
              <p className="text-sm text-ink-muted">{home.city}</p>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{actions}</div>}
            {!owner && (
              <p className="flex items-start gap-2 text-sm text-ink-muted">
                <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
                Only the city and a household summary are shown here. The exact address and phone number are shared after a Meet &amp; Greet is confirmed.
              </p>
            )}
          </div>
        </Card>

        {show(Boolean(home.about_home)) && (
          <Card title="About our home" as="section">
            {home.about_home ? <p className="max-w-[65ch] whitespace-pre-line">{home.about_home}</p> : NOT_ADDED}
          </Card>
        )}

        {(show(answered(space)) || show(answered(lifestyle))) && (
          <div className="grid gap-6 md:grid-cols-2">
            {show(answered(space)) && (
              <Card title="Household & space" as="section">
                <Answers rows={space} />
              </Card>
            )}
            {show(answered(lifestyle)) && (
              <Card title="Lifestyle" as="section">
                <Answers rows={lifestyle} />
              </Card>
            )}
          </div>
        )}

        {show(answered(lookingFor)) && (
          <Card title="What we’re looking for" as="section">
            <Answers rows={lookingFor} />
          </Card>
        )}

        {home.adopted_pets.length > 0 && (
          <Card title="Adopted pets (Alumni)" as="section">
            <ul className="flex flex-col divide-y divide-line">
              {home.adopted_pets.map((adoption) => (
                <li key={adoption.adoption_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <Avatar name={adoption.pet.name} src={adoption.pet.photo_url ?? undefined} alt="" size="md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Link href={petPath(adoption.pet.id)} className="truncate font-bold underline-offset-4 hover:underline">
                      {adoption.pet.name}
                    </Link>
                    <span className="truncate text-sm text-ink-muted">
                      {adoption.pet.breed}
                      {adoption.adopted_at && ` · Hired ${formatDate(adoption.adopted_at)}`}
                    </span>
                  </span>
                  <StatusBadge status="Hired" />
                  {adoptedPetAction?.(adoption)}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {aside && <aside className="flex min-w-0 flex-col gap-6">{aside}</aside>}
    </div>
  );
}
