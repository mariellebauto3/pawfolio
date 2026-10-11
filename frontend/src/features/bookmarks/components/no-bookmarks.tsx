import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";

type Props = {
  /** What this account saves: a human saves pets, a pet saves homes. */
  kind: "pets" | "homes";
};

// BM-04: nothing saved yet. Says where the Bookmark button is and offers the list most worth saving from.
export function NoBookmarks({ kind }: Props) {
  return (
    <EmptyState
      icon="bookmark"
      title={kind === "pets" ? "No saved pets yet" : "No saved homes yet"}
      description={
        kind === "pets"
          ? "Press Bookmark on any resume to keep it here for later."
          : "Press Bookmark on any Home Profile to keep it here for later."
      }
      action={
        <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
          {kind === "pets" ? "See Pets for You" : "See Homes for You"}
        </Link>
      }
      secondaryAction={
        <Link href={ROUTES.browse} className={buttonClasses()}>
          {kind === "pets" ? "Browse pets" : "Browse homes"}
        </Link>
      }
    />
  );
}
