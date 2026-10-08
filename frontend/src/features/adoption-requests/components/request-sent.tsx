"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { MAX_OPEN_REQUESTS, REQUEST_EXPIRY_DAYS } from "@/constants/adoption-requests";
import { ROUTES } from "@/constants/routes";
import { formatDate } from "@/lib/utils/format-date";
import type { SentRequest } from "../types/requests";

type Props = {
  homeName: string;
  /** What the API answered: the request, and how many the pet has open now. */
  sent: SentRequest;
};

// RQ-04 Request sent: the request is with the human, who has 14 days to answer. It takes the form's place on the
// same page, so focus moves to its heading and screen readers hear what happened. The count and the expiry date
// are the API's own.
export function RequestSent({ homeName, sent }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  const { request, openRequests } = sent;
  const expires = request.expires_at ? formatDate(request.expires_at) : "";

  return (
    <section className="mx-auto flex w-full max-w-narrow flex-col items-center gap-4 rounded-card border border-line bg-surface px-4 py-10 text-center md:px-8">
      <span className="grid size-16 place-items-center rounded-pill bg-primary-soft text-primary">
        <Icon name="circle-check" className="size-8" />
      </span>
      <StatusBadge status="Sent" />
      <h1 ref={heading} tabIndex={-1} className="text-2xl wrap-break-word md:text-3xl">
        Request sent to {homeName}
      </h1>
      <p className="max-w-[52ch] text-ink-muted">
        {homeName} has {REQUEST_EXPIRY_DAYS} days to answer. You’ll get a notification when they approve or decline.
      </p>

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 rounded-control bg-surface-sunken px-4 py-3 text-left text-sm">
        {openRequests !== null && (
          <>
            <dt className="text-ink-muted">Open requests</dt>
            <dd className="font-bold">
              {openRequests} of {MAX_OPEN_REQUESTS}
              {openRequests >= MAX_OPEN_REQUESTS && <span className="font-normal"> (limit reached)</span>}
            </dd>
          </>
        )}
        {expires && (
          <>
            <dt className="text-ink-muted">Expires</dt>
            <dd>
              <span className="font-bold">{expires}</span> if there’s no answer
            </dd>
          </>
        )}
      </dl>

      <div className="mt-2 flex flex-col gap-3 self-stretch sm:flex-row sm:justify-center sm:self-auto">
        <Link href={ROUTES.requests} className={buttonClasses({ variant: "primary" })}>
          Track my requests
        </Link>
        <Link href={ROUTES.matches} className={buttonClasses()}>
          Back to Homes for You
        </Link>
      </div>
    </section>
  );
}
