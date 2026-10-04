import Link from "next/link";
import type { ReactNode } from "react";
import { Banner } from "@/components/feedback/banner";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Photo } from "@/components/ui/photo";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tag } from "@/components/ui/tag";
import {
  ENERGY_LEVEL_LABELS,
  EXPERIENCE_NEEDED_LABELS,
  GOOD_WITH_LABELS,
  PET_SEX_LABELS,
  PET_SIZE_LABELS,
  PET_SKILL_LABELS,
  PET_STATUS_NAMES,
  SPACE_NEEDS_LABELS,
  SPECIAL_NEED_LABELS,
  SPECIES_LABELS,
  TIME_ALONE_LABELS,
} from "@/constants/pets";
import { homeProfilePath } from "@/constants/routes";
import { formatAgeMonths } from "@/lib/utils/format-age";
import { formatDate } from "@/lib/utils/format-date";
import type { Pet } from "@/types/pet";

type Props = {
  pet: Pet;
  /** Buttons under the name: the owner's "Edit resume", a human's "Invite to Apply". */
  actions?: ReactNode;
  /** Above the resume, e.g. the Draft banner (PR-02). */
  notice?: ReactNode;
  /** The right-hand column: profile strength for the owner, the match for a human. Below the resume on phones. */
  aside?: ReactNode;
  /** The owner sees "Not added yet" where a section is still empty; other viewers only get sections with content. */
  owner?: boolean;
};

const NOT_ADDED = <p className="text-ink-muted">Not added yet.</p>;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// A pet's resume as a profile page (PR-01, DS-04): cover, photo, name and status, then About, Photos, Temperament,
// Skills, Compatibility & needs and Health. The same view for the pet itself and for a human reading it; what each
// may do comes in through `actions` and `aside`. The status is a read-only badge: it changes only through the
// system (FR27). Everything typed by a caretaker is rendered as plain text (SEC-FE-01).
export function PetResume({ pet, actions, notice, aside, owner = false }: Props) {
  const facts = [
    SPECIES_LABELS[pet.species],
    pet.breed,
    pet.sex && PET_SEX_LABELS[pet.sex],
    formatAgeMonths(pet.approximate_age_months),
    pet.size && PET_SIZE_LABELS[pet.size],
  ].filter(Boolean);
  const profilePhoto = pet.photos[0];
  const show = (hasContent: boolean) => hasContent || owner;

  const compatibility: [string, string | null | undefined][] = [
    ["Good with kids", pet.good_with_kids && GOOD_WITH_LABELS[pet.good_with_kids]],
    ["Good with dogs", pet.good_with_dogs && GOOD_WITH_LABELS[pet.good_with_dogs]],
    ["Good with cats", pet.good_with_cats && GOOD_WITH_LABELS[pet.good_with_cats]],
    ["Energy level", pet.energy_level && ENERGY_LEVEL_LABELS[pet.energy_level]],
    ["Can be left alone", pet.time_alone && TIME_ALONE_LABELS[pet.time_alone]],
    ["Space", pet.space_needs && SPACE_NEEDS_LABELS[pet.space_needs]],
    ["Owner experience", pet.experience_needed && EXPERIENCE_NEEDED_LABELS[pet.experience_needed]],
    ["Special needs", pet.special_needs.length ? pet.special_needs.map((need) => SPECIAL_NEED_LABELS[need]).join(", ") : "None"],
  ];
  const answered = compatibility.slice(0, -1).some(([, value]) => value);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        {notice}

        <Card padding="none" as="section">
          <Photo
            ratio="cover"
            rounded={false}
            src={pet.cover_photo_url ?? undefined}
            alt={pet.cover_photo_url ? `${pet.name}'s cover photo` : "No cover photo yet"}
            sizes="(min-width: 1024px) 800px, 100vw"
            preload
          />
          <div className="flex flex-col gap-4 px-4 pb-5 md:px-5">
            <Avatar
              name={pet.name}
              src={profilePhoto?.url}
              alt={profilePhoto ? `${pet.name}'s profile photo` : pet.name}
              size="xl"
              className="-mt-12 ring-4 ring-surface"
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-3xl">{pet.name}</h1>
                <StatusBadge status={PET_STATUS_NAMES[pet.status]} />
              </div>
              <p>{facts.join(" · ")}</p>
              <p className="text-sm text-ink-muted">
                {pet.city}, {pet.province} · Currently at: {pet.currently_at}
              </p>
              <p className="text-sm text-ink-muted">
                {count(pet.views_count, "profile view", "profile views")} · Bookmarked by {pet.bookmarks_count}
              </p>
            </div>
            {pet.hired_by && (
              <Banner tone="celebrate" icon="heart" title={<>Hired by <Link href={homeProfilePath(pet.hired_by.home_profile_id)} className="underline">{pet.hired_by.full_name}</Link></>}>
                Alumni since {formatDate(pet.hired_by.adopted_at)}. This profile is permanently linked to the Furparent.
              </Banner>
            )}
            {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          </div>
        </Card>

        {show(Boolean(pet.bio)) && (
          <Card title="About" as="section">
            {pet.bio ? <p className="whitespace-pre-line">{pet.bio}</p> : NOT_ADDED}
          </Card>
        )}

        {show(pet.photos.length > 0) && (
          <Card
            title="Photos"
            as="section"
            action={<span className="text-sm text-ink-muted">{count(pet.photos.length, "photo", "photos")}</span>}
          >
            {pet.photos.length ? (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {pet.photos.map((photo, index) => (
                  <li key={photo.id}>
                    <figure className="flex flex-col gap-1.5">
                      <Photo
                        src={photo.url}
                        alt={photo.caption ? `${pet.name}: ${photo.caption}` : `${pet.name}, photo ${index + 1}`}
                        sizes="(min-width: 768px) 260px, 50vw"
                      />
                      {photo.caption && <figcaption className="text-sm text-ink-muted">{photo.caption}</figcaption>}
                    </figure>
                  </li>
                ))}
              </ul>
            ) : (
              NOT_ADDED
            )}
          </Card>
        )}

        {(show(pet.temperament_tags.length > 0) || show(pet.skills.length > 0)) && (
          <div className="grid gap-6 md:grid-cols-2">
            {show(pet.temperament_tags.length > 0) && (
              <Card title="Temperament" as="section">
                {pet.temperament_tags.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {pet.temperament_tags.map((tag) => (
                      <li key={tag}>
                        <Tag>{tag}</Tag>
                      </li>
                    ))}
                  </ul>
                ) : (
                  NOT_ADDED
                )}
              </Card>
            )}
            {show(pet.skills.length > 0) && (
              <Card title="Skills" as="section">
                {pet.skills.length ? (
                  <ul className="flex flex-col gap-2">
                    {pet.skills.map((skill) => (
                      <li key={skill} className="flex items-baseline justify-between gap-3">
                        <span>{PET_SKILL_LABELS[skill] ?? skill}</span>
                        <span className="shrink-0 text-sm text-ink-muted">by caretaker</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  NOT_ADDED
                )}
              </Card>
            )}
          </div>
        )}

        {show(answered) && (
          <Card title="Compatibility & needs" as="section">
            {answered ? (
              <dl className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-4 gap-y-2">
                {compatibility.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-sm text-ink-muted">{label}</dt>
                    <dd>{value || <span className="text-ink-muted">Not answered yet</span>}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              NOT_ADDED
            )}
          </Card>
        )}

        {show(Boolean(pet.health_notes)) && (
          <Card title="Health & vet notes" as="section">
            {pet.health_notes ? <p className="whitespace-pre-line">{pet.health_notes}</p> : NOT_ADDED}
          </Card>
        )}
      </div>

      {aside && <aside className="flex min-w-0 flex-col gap-6">{aside}</aside>}
    </div>
  );
}
