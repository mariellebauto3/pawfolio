import Link from "next/link";
import type { ReactNode } from "react";
import { Timeline } from "@/components/data-display/timeline";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { formatDateTime } from "@/lib/utils/format-date";
import type { AdoptionRequest } from "@/types/adoption-request";
import { type RequestReader, requestTimeline } from "../schemas/request-status";

// The parts of a request's page that both sides read (RQ-11, RQ-14…RQ-17): what the pet wrote, what goes with it,
// and what has happened to it since. Everything typed by a person is rendered as plain text (SEC-FE-01).

/** The cover letter and the caretaker's notes, as the pet sent them. */
export function RequestLetter({ request }: { request: AdoptionRequest }) {
  return (
    <>
      <Card title="Cover letter" description="Why I’d fit your home">
        {/* The pet's own words, set apart in the heading face like the note on an invite. */}
        <blockquote className="rounded-control bg-surface-sunken px-4 py-3 font-display text-lg wrap-break-word whitespace-pre-line">
          {request.cover_letter}
        </blockquote>
      </Card>
      {request.caretaker_notes && (
        <Card title="Caretaker’s notes">
          <p className="max-w-[65ch] wrap-break-word whitespace-pre-line">{request.caretaker_notes}</p>
        </Card>
      )}
    </>
  );
}

type AttachedProps = {
  request: AdoptionRequest;
  /** Where the resume opens for this reader: the pet's own profile page, or the public resume. */
  resumeHref: string;
  /** More that goes with the request for this reader, such as the match for the human. */
  children?: ReactNode;
};

/** What travels with every request without being typed: the resume and its health summary. */
export function RequestAttachments({ request, resumeHref, children }: AttachedProps) {
  const { pet } = request;

  return (
    <Card title="Attached automatically">
      <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <li>
          <Link
            href={resumeHref}
            className="flex min-h-11 items-center gap-3 rounded-control border border-line px-3 py-2 font-bold transition-colors duration-200 hover:border-primary hover:text-primary"
          >
            {/* The name is written beside it, so the photo isn't read out as well. */}
            <Avatar name={pet.name} src={pet.photo_url ?? undefined} alt="" size="sm" />
            {pet.name}’s resume
          </Link>
        </li>
        <li className="flex min-h-11 items-center gap-3 rounded-control border border-line px-3 py-2 font-bold">
          <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-primary-soft text-primary-soft-ink">
            <Icon name="heart" className="size-4" />
          </span>
          Health summary
        </li>
        {children}
      </ul>
    </Card>
  );
}

/** What has happened to the request, oldest first, from the dates the API keeps, told to whoever is reading. */
export function RequestHistory({ request, reader }: { request: AdoptionRequest; reader: RequestReader }) {
  const events = requestTimeline(request, reader).map(({ at, ...event }) => ({ ...event, when: formatDateTime(at), dateTime: at }));
  if (events.length === 0) return null;

  return (
    <Card title="History">
      <Timeline label="Request history" events={events} />
    </Card>
  );
}
