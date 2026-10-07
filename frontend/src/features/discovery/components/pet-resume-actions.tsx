import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// What a human can do from a resume (DS-05): Invite to Apply (FR9, RQ-01) and Bookmark (FR8, BM-03). Both are
// wired by FE-14, which owns the invite dialog and the bookmark calls; until then they show where they will be and
// can't be pressed. An adopted pet's profile has neither (DS-08).
export function PetResumeActions() {
  return (
    <>
      <Button variant="primary" disabled>
        Invite to Apply
      </Button>
      <Button icon={<Icon name="bookmark" className="size-4 shrink-0" />} disabled>
        Bookmark
      </Button>
    </>
  );
}
