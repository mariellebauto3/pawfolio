import type { ReactNode } from "react";

type Props = {
  /** The left rail: the mini profile card. */
  profile: ReactNode;
  /** The right rail: matches, invites, announcements. */
  aside: ReactNode;
  /** The feed itself. */
  children: ReactNode;
};

// The feed's three columns (FD-01, FD-02): the mini profile, the posts, and the cards beside them. Below `lg` the
// two rails are hidden and the posts take the page, as in the mobile LoFi; what the rails link to is in the top bar,
// the tab bar and the Me menu at that width.
export function FeedLayout({ profile, aside, children }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-[14.5rem_minmax(0,1fr)_18.5rem] lg:items-start">
      <div className="hidden lg:flex lg:flex-col lg:gap-4">{profile}</div>
      <div className="mx-auto w-full max-w-xl min-w-0 lg:max-w-none">{children}</div>
      <aside aria-label="Beside the feed" className="hidden lg:flex lg:flex-col lg:gap-4">
        {aside}
      </aside>
    </div>
  );
}
