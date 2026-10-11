"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import type { OwnHomeProfile } from "../types/own-home-profile";
import { OpenToAdoptToggle } from "./open-to-adopt-toggle";

type Props = {
  home: OwnHomeProfile;
  onChange: (home: OwnHomeProfile) => void;
  /** How many pets match the home now; null when the count couldn't be read. */
  matches: number | null;
};

// PR-20 Home Profile saved: the matches were worked out again, and the one switch left to decide is whether pets
// may send requests (FR4).
export function HomeProfileSaved({ home, onChange, matches }: Props) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <Icon name="circle-check" className="size-10 text-primary" />
        <div className="flex flex-col items-center gap-2">
          <h1 tabIndex={-1} className="text-3xl md:text-4xl">
            Home Profile saved
          </h1>
          <p className="max-w-[52ch] text-ink-muted">
            Your match scores were recalculated.
            {matches !== null && (matches === 1 ? " 1 pet matches your home." : ` ${matches} pets match your home.`)}
          </p>
        </div>

        <div className="w-full max-w-dialog rounded-card border border-line px-4 py-2 text-left">
          <OpenToAdoptToggle
            home={home}
            onChange={onChange}
            description={home.is_open_to_adopt ? "Pets can send you adoption requests." : "Turn it on to let pets send you adoption requests."}
          />
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
            See Pets for You
          </Link>
          <Link href={ROUTES.me} className={buttonClasses({ variant: "secondary" })}>
            View my profile
          </Link>
        </div>
      </div>
    </Card>
  );
}
