import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PetResume } from "@/components/data-display/pet-resume";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES, petPath } from "@/constants/routes";
import { AdoptionDetailsButton } from "@/features/adoption/components/adoption-details-button";
import { InviteToApplyButton } from "@/features/adoption-requests/components/invite-to-apply-button";
import { BookmarkButton } from "@/features/bookmarks/components/bookmark-button";
import { getPetProfile, getSimilarPets } from "@/features/discovery/api/discovery";
import { MatchSummary } from "@/features/discovery/components/match-summary";
import { SimilarPets } from "@/features/discovery/components/similar-pets";
import { MatchBreakdownButton } from "@/features/matching/components/match-breakdown-button";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";
import { requireAccount } from "@/lib/auth/require-account";

export const metadata: Metadata = { title: "Pet resume" };

type Props = {
  params: Promise<{ petId: string }>;
};

// DS-05 Pet resume as a human reads it, with the photo viewer (DS-06) on its photos, and DS-08 the alumni profile
// once the pet is Hired: the Hired badge and the "Hired by …" banner, and nothing to invite or bookmark. A human
// gets Invite to Apply (RQ-01) while the pet is Looking for a Home, and Bookmark (BM-03) until it is adopted; the
// API checks both again (SEC-FE-05). The pet's own Furparent reads it as AL-05, with the adoption's details (AL-06)
// and the way to an adoption story (FD-04); the API answers those details to the two sides and admins only. The API decides who may see a resume: a Draft and a pet whose account isn't
// Active answer 404, the same page as a broken link (SEC-AUTHZ-04). Contact details are not part of what it sends
// here (NFR4).
export default async function PetPage({ params }: Props) {
  const { petId } = await params;
  // Only a plain id goes to the API (SEC-FE-08); anything else is a page that doesn't exist.
  if (!/^[1-9]\d{0,14}$/.test(petId)) notFound();
  const id = Number(petId);

  const account = await requireAccount(petPath(id));
  // A pet's own resume has its own page, with what only the pet sees.
  if (account.role === "pet" && account.profile_id === id) redirect(ROUTES.me);

  const api = await getServerApi();
  const pet = await getPetProfile(api, id).catch((error: unknown) => {
    if (isApiError(error) && error.kind === "not_found") notFound();
    throw error;
  });

  const hired = pet.status === "adopted_hired";
  const adopter = account.role === "human" && !hired;
  // The human this pet is linked to (FR13). The API says who that is; the session says who is reading.
  const adoption = account.role === "human" && pet.hired_by?.home_profile_id === account.profile_id ? pet.hired_by : null;
  // An extra: the resume shows even when the side list can't be loaded.
  const similar = await getSimilarPets(api, pet).catch(() => []);

  return (
    <PetResume
      pet={pet}
      actions={
        adoption ? (
          <>
            <AdoptionDetailsButton adoptionId={adoption.adoption_id} petName={pet.name} variant="primary" />
            <Link href={ROUTES.memberHome} className={buttonClasses()}>
              Write an adoption story
            </Link>
          </>
        ) : (
          adopter && (
            <>
              {/* Only a pet that is Looking for a Home can be invited; one that is In Process can still be saved. */}
              {pet.status === "looking_for_a_home" && (
                <InviteToApplyButton pet={pet} score={pet.match?.passed_dealbreakers ? pet.match.score : undefined} invited={pet.invited_at !== null} />
              )}
              <BookmarkButton target={{ kind: "pet", id: pet.id }} name={pet.name} saved={pet.is_bookmarked === true} />
            </>
          )
        )
      }
      aside={
        (adopter || similar.length > 0) && (
          <>
            {adopter && (
              <MatchSummary
                name={pet.name}
                match={pet.match}
                missing={{
                  text: `Finish your Home Profile and lifestyle quiz to see how well you and ${pet.name} fit.`,
                  action: { href: ROUTES.homeProfileEdit, label: "Finish the quiz" },
                }}
                breakdown={<MatchBreakdownButton profileId={pet.id} name={pet.name} score={pet.match?.score} placement="profile" />}
              />
            )}
            <SimilarPets pets={similar} />
          </>
        )
      }
    />
  );
}
