import Link from "next/link";
import { EmptyState } from "@/components/feedback/empty-state";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";

// Invites to Apply with nothing on it (RQ-02). An invite is a bonus: the pet can always apply on its own, so the
// way forward is the homes that fit it.
export function NoInvites() {
  return (
    <EmptyState
      icon="mail"
      title="No invites right now"
      description="When a human invites you to apply, you’ll find it here. You don’t have to wait for one: you can apply to any home that is Open to Adopt."
      action={
        <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
          See Homes for You
        </Link>
      }
      secondaryAction={
        <Link href={ROUTES.browse} className={buttonClasses()}>
          Browse homes
        </Link>
      }
    />
  );
}
