"use client";

import Link from "next/link";
import { Timeline } from "@/components/data-display/timeline";
import { Alert } from "@/components/feedback/alert";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { SPECIES_LABELS } from "@/constants/pets";
import { ROUTES, requestPath } from "@/constants/routes";
import { formatDate, formatDateTime } from "@/lib/utils/format-date";
import { AdoptionLink } from "../components/adoption-link";
import { useAdoptionRecord } from "../hooks/use-adoption-record";
import { adoptionTimeline, daysToAdoption } from "../schemas/adoptions";
import type { AdoptionRecord } from "../types/adoptions";

type Props = {
  open: boolean;
  onClose: () => void;
  adoptionId: number;
  /** For the title while the record loads. */
  petName: string;
  /** Leaves out "Open request record" where the dialog is opened from that record itself (AL-04). */
  onRecord?: boolean;
};

function Record({ record }: { record: AdoptionRecord }) {
  const { pet, home_profile: home } = record;
  const events = adoptionTimeline(record).map(({ at, ...event }) => ({ ...event, when: formatDateTime(at), dateTime: at }));
  const days = daysToAdoption(record.days_to_adoption);

  return (
    <>
      <AdoptionLink
        state="linked"
        pet={{ name: pet.name, photoUrl: pet.photo_url, caption: [SPECIES_LABELS[pet.species], pet.breed].filter(Boolean).join(" · ") }}
        home={{ name: home.full_name, photoUrl: home.profile_photo_url, caption: ["Furparent", home.city].filter(Boolean).join(" · ") }}
      />

      {events.length > 0 && <Timeline label="Adoption timeline" events={events} />}

      {(days || record.cover_letter) && (
        <dl className="flex flex-col gap-3 border-t border-line pt-4">
          {days && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-ink-muted">Days to adoption</dt>
              <dd className="font-display text-xl font-bold tabular-nums">{days}</dd>
            </div>
          )}
          {record.cover_letter && (
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-ink-muted">Cover letter</dt>
              {/* The pet's own words, as plain text (SEC-FE-01). */}
              <dd>
                <blockquote className="rounded-control bg-surface-sunken px-3 py-2 font-display wrap-break-word whitespace-pre-line">{record.cover_letter}</blockquote>
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* Stories are written on the community feed (FD-04). */}
      <Link href={ROUTES.memberHome} className={buttonClasses({ size: "sm", className: "self-start" })}>
        Write an adoption story
      </Link>
    </>
  );
}

function Loading() {
  return (
    <SkeletonGroup label="Loading the adoption details" className="flex flex-col gap-4">
      <span className="flex items-center justify-center gap-6">
        <Skeleton shape="circle" className="size-14" />
        <Skeleton className="h-6 w-16" />
        <Skeleton shape="circle" className="size-14" />
      </span>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full" />
      ))}
      <Skeleton shape="block" className="h-16 w-full" />
    </SkeletonGroup>
  );
}

// AL-06 Adoption details: the link between a pet and its Furparent, how the request became an adoption, how many
// days it took, and the cover letter that started it (FR14). Read from the API when the dialog opens; the API
// answers only the pet, the Furparent and admins (SEC-AUTHZ-03), and what it sends is kept in memory only
// (SEC-FE-04).
export function AdoptionDetailsDialog({ open, onClose, adoptionId, petName, onRecord = false }: Props) {
  const state = useAdoptionRecord(adoptionId, open);
  const record = state.status === "ready" ? state.record : null;

  function close() {
    // A record that failed to load is asked for again the next time the dialog opens.
    if (state.status === "error" && !state.gone) state.retry();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={`Adoption details: ${record?.pet.name ?? petName}`}
      subtitle={record?.adopted_at ? `Hired by ${record.home_profile.full_name} on ${formatDate(record.adopted_at)}` : undefined}
      footer={
        <>
          {record && !onRecord && (
            <Link href={requestPath(record.adoption_request_id)} className={buttonClasses()}>
              Open request record
            </Link>
          )}
          <Button variant="primary" onClick={close}>
            Close
          </Button>
        </>
      }
    >
      {record && <Record record={record} />}
      {(state.status === "loading" || state.status === "idle") && <Loading />}
      {state.status === "error" && (
        <Alert
          tone={state.gone ? "info" : "error"}
          announce
          title={state.gone ? "These adoption details aren’t available" : "The adoption details didn’t load"}
          action={
            !state.gone && (
              <Button size="sm" onClick={state.retry}>
                Try again
              </Button>
            )
          }
        >
          {state.gone ? "Only the pet, its Furparent and admins can read an adoption’s details." : state.message}
        </Alert>
      )}
    </Modal>
  );
}
