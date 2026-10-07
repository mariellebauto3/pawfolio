import { Photo } from "@/components/ui/photo";
import { StatusBadge } from "@/components/ui/status-badge";
import { PET_SIZE_LABELS, PET_STATUS_NAMES } from "@/constants/pets";
import { petPath } from "@/constants/routes";
import { formatAgeMonths } from "@/lib/utils/format-age";
import type { Pet } from "@/types/pet";
import { MatchCard } from "./match-card";

type Props = {
  pet: Pet;
  /** The viewer's match with this pet, when there is one. */
  score?: number;
  /** Rendered width hint for the photo, e.g. "(min-width: 1280px) 264px, 50vw". */
  sizes?: string;
  titleAs?: "h2" | "h3";
};

// A pet on a card: its profile photo first, the way a resume leads with one. "Looking for a Home" is what every
// listed pet is, so only the other statuses get a badge.
export function PetCard({ pet, score, sizes = "(min-width: 768px) 320px, 100vw", titleAs }: Props) {
  const photo = pet.photos[0];
  const facts = [pet.breed, formatAgeMonths(pet.approximate_age_months), pet.size && PET_SIZE_LABELS[pet.size]].filter(Boolean);

  return (
    <MatchCard
      href={petPath(pet.id)}
      title={pet.name}
      titleAs={titleAs}
      media={
        <Photo
          src={photo?.url}
          alt={photo ? (photo.caption ? `${pet.name}: ${photo.caption}` : `Photo of ${pet.name}`) : "No photo yet"}
          sizes={sizes}
          rounded={false}
        />
      }
      facts={[facts.join(" · "), `${pet.city}, ${pet.province}`]}
      badges={pet.status !== "looking_for_a_home" && <StatusBadge status={PET_STATUS_NAMES[pet.status]} />}
      tags={pet.temperament_tags.slice(0, 2)}
      score={score}
      cta="View resume"
    />
  );
}
