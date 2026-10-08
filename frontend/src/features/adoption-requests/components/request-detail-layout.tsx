import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";

type Props = {
  /** The header card: who the request is between, its status and where it stands (`RequestHeader`). */
  header: ReactNode;
  /** What the reader can do now. Beside the content on desktop; first on a phone, above everything it is about. */
  panel: ReactNode;
  /** The request itself: the cover letter, the notes, what is attached, the thread. */
  children: ReactNode;
  /** What else belongs beside the content: the history, the other side's profile. Under the content on a phone. */
  aside?: ReactNode;
};

// The page of one adoption request (RQ-11, RQ-14…RQ-17, and the Meet & Greet screens that build on it): the
// header, the action panel, the request and what goes beside it. Either side of a request reads the same layout;
// what differs is what each is handed. On a phone the action panel comes first, as the mobile LoFi has it, and it
// is first in the page's order too, so a keyboard and a screen reader reach the next step before the letter.
export function RequestDetailLayout({ header, panel, children, aside }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Link href={ROUTES.requests} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-primary hover:underline md:min-h-0">
        <Icon name="chevron-left" className="size-4 shrink-0" />
        All requests
      </Link>

      {header}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr]">
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1">{panel}</div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">{children}</div>
        {aside && <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-2">{aside}</div>}
      </div>
    </div>
  );
}
