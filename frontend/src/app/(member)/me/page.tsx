import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { AdoptionDetailsButton } from "@/features/adoption/components/adoption-details-button";
import { getOwnHomeProfile } from "@/features/profiles/api/home-profile";
import { getLatestPosts, getOwnPet, getSimilarPets } from "@/features/profiles/api/resume";
import { MyHomeProfile } from "@/features/profiles/components/my-home-profile";
import { MyResume } from "@/features/profiles/components/my-resume";
import { getServerApi } from "@/lib/api/server";
import { homePathFor, signInPath } from "@/lib/auth/redirects";
import { fetchSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My profile" };

// "/me" is the signed-in account's own profile: a pet's resume (PR-01, PR-02), a human's Home Profile (PR-11). A
// Furparent's adopted pets each open their adoption details there (AL-06, FR13, FR14).
export default async function MePage() {
  const api = await getServerApi();
  const account = await fetchSession(api);
  if (!account) redirect(signInPath(ROUTES.me));
  if (account.role === "admin") redirect(homePathFor(account));

  if (account.role === "human") {
    const home = await getOwnHomeProfile(api);
    const adoptionDetails = Object.fromEntries(
      home.adopted_pets.map(({ adoption_id, pet }) => [adoption_id, <AdoptionDetailsButton key={adoption_id} adoptionId={adoption_id} petName={pet.name} size="sm" named />]),
    );
    return <MyHomeProfile home={home} adoptionDetails={adoptionDetails} />;
  }

  const pet = await getOwnPet(api);
  // The two side cards are extras: the resume shows even when one of them can't be loaded.
  const [posts, similar] = await Promise.allSettled([getLatestPosts(api, account.id), getSimilarPets(api, pet)]);

  return (
    <MyResume
      pet={pet}
      posts={posts.status === "fulfilled" ? posts.value : null}
      similar={similar.status === "fulfilled" ? similar.value : null}
    />
  );
}
