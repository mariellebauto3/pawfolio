import { Suspense } from "react";
import { GuestShell } from "@/components/layout/guest-shell";
import { HowItWorks } from "@/features/auth/components/landing/how-it-works";
import { LandingFaq } from "@/features/auth/components/landing/landing-faq";
import { LandingHero } from "@/features/auth/components/landing/landing-hero";
import {
  RecentlyHiredList,
  RecentlyHiredSection,
  RecentlyHiredSkeleton,
} from "@/features/auth/components/landing/recently-hired";
import { VerificationPromise } from "@/features/auth/components/landing/verification-promise";

// AU-01 Landing page. Section ids match LANDING_SECTIONS, which the guest top bar and footer link to.
export default function Home() {
  return (
    <GuestShell>
      <LandingHero />
      <HowItWorks />
      <RecentlyHiredSection>
        <Suspense fallback={<RecentlyHiredSkeleton />}>
          <RecentlyHiredList />
        </Suspense>
      </RecentlyHiredSection>
      <LandingFaq />
      <VerificationPromise />
    </GuestShell>
  );
}
