import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { HOME_TYPE_LABELS, householdSummary } from "@/constants/home-profiles";
import type { HomeProfile } from "@/types/home-profile";
import { MatchChip } from "./match-chip";

type Props = {
  home: Pick<HomeProfile, "full_name" | "city" | "profile_photo_url" | "home_type" | "household_members" | "is_furparent">;
  /** The pet's match with this home, when there is one. */
  score?: number;
};

// Who the request goes to, above the cover letter (RQ-03): the home as its public profile names it, and how well
// the two fit. The city and a household summary only, never an address (SEC-PRIV-03).
export function RequestRecipient({ home, score }: Props) {
  const facts = [home.city, home.home_type && HOME_TYPE_LABELS[home.home_type], householdSummary(home)].filter(Boolean).join(" · ");

  return (
    <section aria-label="Recipient" className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 md:p-5">
      {/* The name is written beside it, so the photo isn't read out as well. */}
      <Avatar name={home.full_name} src={home.profile_photo_url ?? undefined} alt="" size="lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-display text-xl font-semibold wrap-break-word">
          <span className="font-sans text-sm font-normal text-ink-muted">To </span>
          {home.full_name}
        </p>
        {facts && <p className="text-sm text-ink-muted">{facts}</p>}
        {home.is_furparent && (
          <div className="pt-1">
            <StatusBadge status="Furparent" />
          </div>
        )}
      </div>
      <MatchChip score={score} />
    </section>
  );
}
