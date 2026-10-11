import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { ROUTES } from "@/constants/routes";

// PR-10 Resume published: the status change the system just made, and where to go next.
export function ResumePublished({ name }: { name: string }) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="flex flex-wrap items-center justify-center gap-2">
          <StatusBadge status="Draft" />
          <Icon name="chevron-right" className="size-4 text-ink-muted" />
          <span className="sr-only">changed to</span>
          <StatusBadge status="Looking for a Home" />
        </p>
        <h1 tabIndex={-1} className="text-3xl md:text-4xl">
          Your resume is live!
        </h1>
        <p className="max-w-[52ch] text-ink-muted">
          {name} now appears in search and in humans&apos; Pets for You. A “For Hire” post was added to the feed.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
            See Homes for You
          </Link>
          <Link href={ROUTES.me} className={buttonClasses({ variant: "secondary" })}>
            View my resume
          </Link>
          <Link href={ROUTES.memberHome} className={buttonClasses({ variant: "tertiary" })}>
            See my For Hire post
          </Link>
        </div>
      </div>
    </Card>
  );
}
