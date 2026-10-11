import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { findPets, getRecentResolutions, getResolveOptions } from "@/features/adoption/api/resolutions";
import { PetFinder } from "@/features/adoption/components/pet-finder";
import { RecentResolutions } from "@/features/adoption/components/recent-resolutions";
import { ResolvePetCard } from "@/features/adoption/components/resolve-pet-card";
import { resolveTargetFromUrl } from "@/features/adoption/schemas/resolutions";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";

export const metadata: Metadata = { title: "Resolve adoption issue" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// AL-07 Resolve adoption issue, with its confirmation AL-08 on it. Opened from an overdue request, a request's
// record or the Alumni tab, the pet and the request are in the address (?pet=3&request=12); opened from the sidebar,
// it first asks which pet (?q=…). Only plain ids go on to the API (SEC-FE-08), which checks the admin role and
// decides what can be changed (SEC-AUTHZ-07).
export default async function ResolvePage({ searchParams }: Props) {
  const { petId, requestId, search } = resolveTargetFromUrl(await searchParams);
  const api = await getServerApi();

  const [options, matches, recent] = await Promise.all([
    petId === null
      ? null
      : getResolveOptions(api, petId).catch((error: unknown) => {
          if (isApiError(error) && error.kind === "not_found") notFound();
          throw error;
        }),
    // The search is one way in; the page still opens when it can't be run.
    petId === null && search ? findPets(api, search).catch(() => "failed" as const) : null,
    // The list beside the form is a reference: without it the form still works.
    getRecentResolutions(api).catch(() => null),
  ]);

  return (
    <>
      <PageHeader title="Resolve adoption issue" description="The only way to change a pet’s status outside the normal flow. A reason is required and the change is logged." />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {options ? <ResolvePetCard options={options} requestId={requestId} /> : <PetFinder search={search} matches={matches === "failed" ? null : matches} failed={matches === "failed"} />}
        </div>
        <RecentResolutions resolutions={recent?.data ?? null} total={recent?.meta.total} />
      </div>
    </>
  );
}
