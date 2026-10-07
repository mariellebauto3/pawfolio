import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { HOME_TYPE_LABELS, householdSummary } from "@/constants/home-profiles";
import { homeProfilePath } from "@/constants/routes";
import type { HomeProfile } from "@/types/home-profile";
import { MatchCard } from "./match-card";

type Props = {
  home: HomeProfile;
  /** The viewer's match with this home, when there is one. */
  score?: number;
  titleAs?: "h2" | "h3";
};

// A home on a card, read the way a pet reads a job posting: who it is, the home in their own words, then the
// household. Public details only: the city and a household summary, never the address or a phone number
// (SEC-PRIV-03).
export function HomeCard({ home, score, titleAs }: Props) {
  const facts = [home.home_type && HOME_TYPE_LABELS[home.home_type], householdSummary(home)].filter(Boolean);

  return (
    <MatchCard
      href={homeProfilePath(home.id)}
      title={home.full_name}
      titleAs={titleAs}
      // The name is written beside it, so the photo isn't read out as well.
      avatar={<Avatar name={home.full_name} src={home.profile_photo_url ?? undefined} alt="" size="lg" />}
      subtitle={home.headline}
      facts={[facts.join(" · "), home.city].filter(Boolean)}
      badges={home.is_furparent && <StatusBadge status="Furparent" />}
      score={score}
      cta="View home"
    />
  );
}
