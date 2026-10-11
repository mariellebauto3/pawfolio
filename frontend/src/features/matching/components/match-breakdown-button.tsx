"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MatchBreakdownDialog } from "../dialogs/match-breakdown-dialog";

type Props = {
  /** The other side of the pair: the pet's id for a human, the Home Profile's id for a pet. */
  profileId: number;
  name: string;
  /** The score shown beside the button. */
  score?: number;
  /** `card`: "Why this match?" on a match card. `profile`: "See full breakdown" under the score on a profile. */
  placement?: "card" | "profile";
};

// The way into the match breakdown (MT-03), from a match card (MT-01, MT-02) and from "Your match" on a resume or a
// Home Profile (DS-05, DS-07). Each button owns its dialog, so focus returns to the card it was opened from.
export function MatchBreakdownButton({ profileId, name, score, placement = "card" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={placement === "card" ? "tertiary" : "secondary"}
        size="sm"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={placement === "profile" ? "self-start" : undefined}
      >
        {placement === "card" ? "Why this match?" : "See full breakdown"}
        {/* A page lists many of these: each one says whose match it explains. */}
        <span className="sr-only"> ({name})</span>
      </Button>
      <MatchBreakdownDialog open={open} onClose={() => setOpen(false)} profileId={profileId} name={name} score={score} />
    </>
  );
}
