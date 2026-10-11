import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { buttonClasses } from "@/components/ui/button-styles";
import { LANDING_SECTIONS, ROUTES } from "@/constants/routes";
import { getServerApi } from "@/lib/api/server";
import { AlumniGallery } from "./alumni-gallery";
import { fetchRecentlyHired } from "../../api/recently-hired";
import type { RecentlyHiredPet } from "../../types/recently-hired";

// AU-01 "Recently Hired": the success stories the guest top bar links to. The section is always there so the link
// lands; only its list depends on GET /public/recently-hired (docs/api/discovery.md).
export function RecentlyHiredSection({ children }: { children: ReactNode }) {
  return (
    <section
      id={LANDING_SECTIONS.successStories}
      aria-labelledby="recently-hired-title"
      className="scroll-mt-16 px-gutter py-16 md:py-24"
    >
      <div className="mx-auto max-w-content">
        <h2 id="recently-hired-title" className="text-3xl md:text-4xl">
          Recently Hired
        </h2>
        <p className="mt-3 max-w-[50ch] text-lg text-ink-muted">These pets found their Furparent on Pawfolio.</p>
        {children}
      </div>
    </section>
  );
}

/** Loads the alumni on the server. A failed call leaves a short note rather than breaking the landing page. */
export async function RecentlyHiredList() {
  let pets: RecentlyHiredPet[];
  try {
    pets = await fetchRecentlyHired(await getServerApi());
  } catch {
    return <p className="mt-8 text-ink-muted">Success stories couldn&apos;t load just now. Refresh the page to try again.</p>;
  }

  if (pets.length === 0) {
    return (
      <EmptyState
        icon="paw"
        title="The first pets are still job hunting"
        description="Pets show up here on the day a human chooses Adopt."
        action={
          <Link href={ROUTES.signUpPet} className={buttonClasses({ variant: "secondary" })}>
            Sign up a pet
          </Link>
        }
        titleAs="h3"
        className="mt-6"
      />
    );
  }

  return <AlumniGallery pets={pets} />;
}

/** The gallery's shape while alumni load: one open panel and five closed strips. */
export function RecentlyHiredSkeleton() {
  return (
    <SkeletonGroup
      label="Loading success stories"
      className="mt-8 flex h-[34rem] flex-col gap-2 md:mt-10 md:h-[clamp(22rem,36vw,28rem)] md:flex-row md:gap-2.5"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} shape="block" className={index === 0 ? "grow-[5.4] basis-0" : "grow basis-0"} />
      ))}
    </SkeletonGroup>
  );
}
