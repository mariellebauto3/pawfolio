import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PetResume } from "@/components/data-display/pet-resume";
import { ROUTES, petPath } from "@/constants/routes";
import { getPetProfile, getSimilarPets } from "@/features/discovery/api/discovery";
import { MatchSummary } from "@/features/discovery/components/match-summary";
import { PetResumeActions } from "@/features/discovery/components/pet-resume-actions";
import { SimilarPets } from "@/features/discovery/components/similar-pets";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";
import { requireAccount } from "@/lib/auth/require-account";

export const metadata: Metadata = { title: "Pet resume" };

type Props = {
  params: Promise<{ petId: string }>;
};

// DS-05 Pet resume as a human reads it, with the photo viewer (DS-06) on its photos, and DS-08 the alumni profile
// once the pet is Hired: the Hired badge and the "Hired by …" banner, and nothing to invite. The API decides who may
// see a resume: a Draft and a pet whose account isn't Active answer 404, the same page as a broken link
// (SEC-AUTHZ-04). Contact details are not part of what it sends here (NFR4).
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
  // An extra: the resume shows even when the side list can't be loaded.
  const similar = await getSimilarPets(api, pet).catch(() => []);

  return (
    <PetResume
      pet={pet}
      actions={adopter && <PetResumeActions />}
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
              />
            )}
            <SimilarPets pets={similar} />
          </>
        )
      }
    />
  );
}
