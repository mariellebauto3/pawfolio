import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OPEN_REQUEST_STATUSES } from "@/constants/adoption-requests";
import { applyPath, requestPath } from "@/constants/routes";
import { getOwnRequests } from "@/features/adoption-requests/api/requests";
import { ApplyUnavailable } from "@/features/adoption-requests/components/apply-unavailable";
import { RequestRecipient } from "@/features/adoption-requests/components/request-recipient";
import { SendRequestForm } from "@/features/adoption-requests/forms/send-request-form";
import { applyStateFor } from "@/features/adoption-requests/schemas/apply-state";
import { getHomeProfileDetail } from "@/features/discovery/api/discovery";
import { getOwnPet } from "@/features/profiles/api/resume";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import { formatAgeMonths } from "@/lib/utils/format-age";

export const metadata: Metadata = { title: "Send an adoption request" };

type Props = {
  params: Promise<{ homeId: string }>;
};

// RQ-03 Send adoption request, and RQ-04 Request sent once it is. Only a pet applies (proposal §9). The page reads
// the home as the pet may see it and the pet's own requests, so a pet that can't apply right now is told why
// before it writes a letter: a request already open goes to that request, and the limit, the cooldown and a
// request in process read as their dialogs do (RQ-05, RQ-06). The API decides when the request is sent (SEC-FE-05).
export default async function ApplyPage({ params }: Props) {
  const { homeId } = await params;
  // Only a plain id goes to the API (SEC-FE-08); anything else is a page that doesn't exist.
  if (!/^[1-9]\d{0,14}$/.test(homeId)) notFound();
  const id = Number(homeId);

  const account = await requireAccount(applyPath(id));
  if (account.role !== "pet") redirect(homePathFor(account));

  const api = await getServerApi();
  const [home, requests, pet] = await Promise.all([
    // A home the pet may not open answers 404, like one that doesn't exist (SEC-AUTHZ-04).
    getHomeProfileDetail(api, id).catch((error: unknown) => {
      if (isApiError(error) && error.kind === "not_found") notFound();
      throw error;
    }),
    // If the pet's requests can't be read, the form is offered and the API answers for the rules.
    getOwnRequests(api).catch(() => null),
    // The resume only names what is attached; the account's name does when it can't be read.
    getOwnPet(api).catch(() => null),
  ]);

  const state = applyStateFor(home, requests ?? [], new Date());
  if (state.kind === "open") redirect(requestPath(state.requestId));
  if (state.kind !== "can_apply") {
    return <ApplyUnavailable home={{ id: home.id, full_name: home.full_name }} reason={state.kind === "not_accepting" ? "not_accepting" : state} />;
  }

  return (
    <SendRequestForm
      home={{ id: home.id, full_name: home.full_name }}
      pet={{
        name: pet?.name ?? account.display_name,
        photo_url: pet?.photos[0]?.url ?? account.avatar_url,
        facts: pet ? [pet.breed, formatAgeMonths(pet.approximate_age_months), pet.city].filter(Boolean).join(" · ") : null,
      }}
      openRequests={requests ? requests.filter((request) => OPEN_REQUEST_STATUSES.includes(request.status)).length : null}
      recipient={<RequestRecipient home={home} score={home.match?.score} />}
    />
  );
}
