import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/navigation/logo";
import { SignOutButton } from "@/components/navigation/sign-out-button";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/navigation/skip-link";
import { buttonClasses } from "@/components/ui/button-styles";
import { HELP_CENTER_PATH } from "@/constants/routes";

// Pending, Denied and Suspended accounts (AU-18…AU-21) see this shell and nothing else: a minimal bar with Help center
// and Log out. The logo isn't a link, because there is nowhere else for these accounts to go.
export function AccountStatusShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-content items-center gap-2 px-gutter">
          <Logo />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link href={HELP_CENTER_PATH} className={buttonClasses({ variant: "tertiary", size: "sm" })}>
              Help center
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main id={MAIN_CONTENT_ID} className="mx-auto w-full max-w-narrow flex-1 px-gutter py-8 md:py-12">
        {children}
      </main>
    </>
  );
}
