"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { type ShellArea, shellAreaFor } from "@/lib/auth/shell-area";
import { cn } from "@/lib/utils/cn";
import { useSession } from "@/providers/session-provider";
import { EmptyState } from "./empty-state";

type Props = {
  /** Which shell the page sits in. Leave out to pick from the signed-in account (the app-wide not-found page). */
  area?: ShellArea;
};

// GN-02. One message for broken links and for profiles that are hidden, suspended or deactivated, so it never
// reveals that a record exists (SEC-AUTHZ-04).
export function PageNotFound({ area }: Props) {
  const { account } = useSession();
  const shown = area ?? shellAreaFor(account);

  return (
    // The guest shell leaves spacing to its pages (the landing page runs edge to edge); the others already pad.
    <div className={cn("w-full", shown === "guest" && "px-gutter py-12")}>
      <Card className="mx-auto w-full max-w-narrow">
        <EmptyState
          icon="paw"
          titleAs="h1"
          title="This page doesn't exist"
          description="The link may be broken, or the profile may be hidden or deactivated."
          action={<NotFoundActions area={shown} />}
        />
      </Card>
    </div>
  );
}

function NotFoundActions({ area }: { area: ShellArea }) {
  if (area === "admin") {
    return (
      <Link href={ROUTES.adminHome} className={buttonClasses({ variant: "primary" })}>
        Back to dashboard
      </Link>
    );
  }
  if (area === "account-status") {
    return (
      <Link href={ROUTES.accountStatus} className={buttonClasses({ variant: "primary" })}>
        Back to my account
      </Link>
    );
  }
  if (area === "member") {
    return (
      <>
        <Link href={ROUTES.browse} className={buttonClasses({ variant: "secondary" })}>
          Browse
        </Link>
        <Link href={ROUTES.memberHome} className={buttonClasses({ variant: "primary" })}>
          Back to feed
        </Link>
      </>
    );
  }
  return (
    <Link href={ROUTES.landing} className={buttonClasses({ variant: "primary" })}>
      Go to the home page
    </Link>
  );
}
