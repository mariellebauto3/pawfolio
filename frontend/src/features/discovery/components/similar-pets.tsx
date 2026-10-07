import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { petPath } from "@/constants/routes";
import { formatAgeMonths } from "@/lib/utils/format-age";
import type { Pet } from "@/types/pet";

type Props = {
  /** Other pets of the same species that are looking for a home. */
  pets: Pet[];
};

// "Similar pets" beside a resume (DS-05): somewhere to go next without going back to Browse.
export function SimilarPets({ pets }: Props) {
  if (pets.length === 0) return null;

  return (
    <Card title="Similar pets" as="section">
      <ul className="flex flex-col gap-3">
        {pets.map((pet) => (
          <li key={pet.id} className="flex items-center gap-3">
            <Avatar name={pet.name} src={pet.photos[0]?.url} alt="" size="md" />
            <span className="flex min-w-0 flex-col">
              <Link href={petPath(pet.id)} className="truncate font-bold underline-offset-4 hover:underline">
                {pet.name}
              </Link>
              <span className="truncate text-sm text-ink-muted">
                {pet.breed} · {formatAgeMonths(pet.approximate_age_months)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
