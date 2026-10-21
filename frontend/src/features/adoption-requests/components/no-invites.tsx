import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";

type Props = {
  /** The pet is Hired: it can't apply anywhere, so the page doesn't suggest it (proposal §5.5). */
  hired?: boolean;
};

// Invites to Apply with nothing on it (RQ-02). An invite is a bonus: the pet can always apply on its own, so the
// way forward is the homes that fit it. A Hired pet has its home, so it is sent to its alumni profile instead.
export function NoInvites({ hired = false }: Props) {
  if (hired) {
    return (
      <EmptyState
        icon="heart"
        title="You’ve been Hired"
        description="Invites to Apply are for pets that are still looking for a home. Your resume is an alumni profile now, linked to your Furparent."
        action={
          <Link prefetch={false} href={ROUTES.me} className={buttonClasses({ variant: "primary" })}>
            View my profile
          </Link>
        }
        secondaryAction={
          <Link prefetch={false} href={ROUTES.memberHome} className={buttonClasses()}>
            Back to the feed
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      icon="mail"
      title="No invites right now"
      description="When a human invites you to apply, you’ll find it here. You don’t have to wait for one: you can apply to any home that is Open to Adopt."
      action={
        <Link prefetch={false} href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
          See Homes for You
        </Link>
      }
      secondaryAction={
        <Link prefetch={false} href={ROUTES.browse} className={buttonClasses()}>
          Browse homes
        </Link>
      }
    />
  );
}
