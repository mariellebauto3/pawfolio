import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ROUTES } from "@/constants/routes";

export type ProfileStat = {
  label: string;
  value: number;
};

export type ProfileShortcut = {
  label: string;
  href: string;
  /** A number worth seeing from here, such as the invites waiting. Nothing at 0. */
  count?: number;
};

type Props = {
  name: string;
  avatarUrl: string | null;
  /** "Aspin · 2 years · Pasig" for a pet, "Quezon City · Condo" for a human. Left out when the profile couldn't be read. */
  line?: string;
  /** The status badges of the profile: Looking for a Home, Open to Adopt, Furparent. */
  badges?: ReactNode;
  stats?: ProfileStat[];
  shortcuts: ProfileShortcut[];
};

// The mini profile beside the feed (FD-01, FD-02): who you are here, how your profile is doing, and the pages you
// go back to. It shows what the account's own profile says and nothing private: the city, never the address
// (SEC-PRIV-03). The name leads to "/me".
export function FeedProfileCard({ name, avatarUrl, line, badges, stats = [], shortcuts }: Props) {
  return (
    <section aria-label="Your profile" className="overflow-hidden rounded-card border border-line bg-surface">
      <div aria-hidden="true" className="h-14 bg-sky" />
      <div className="flex flex-col items-center gap-2 px-4 pb-4 text-center">
        <Avatar name={name} src={avatarUrl ?? undefined} alt="" size="lg" className="-mt-7 border-2 border-surface" />
        <Link href={ROUTES.me} className="font-display text-xl font-bold text-ink no-underline wrap-break-word hover:text-primary hover:underline">
          {name}
        </Link>
        {line && <p className="text-sm text-ink-muted">{line}</p>}
        {badges && <div className="flex flex-wrap justify-center gap-2">{badges}</div>}
      </div>

      {stats.length > 0 && (
        <dl className="flex flex-col gap-1.5 border-t border-line px-4 py-3 text-sm">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">{stat.label}</dt>
              <dd className="font-bold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <ul className="flex flex-col border-t border-line p-2">
        {shortcuts.map((shortcut) => (
          <li key={shortcut.href}>
            {/* Not prefetched: these are pages for later, not the next thing most visits open. */}
            <Link
              href={shortcut.href}
              prefetch={false}
              className="flex min-h-11 items-center justify-between gap-3 rounded-control px-2 text-sm font-bold text-ink no-underline transition-colors duration-200 ease-out hover:bg-surface-sunken hover:text-primary md:min-h-9"
            >
              {shortcut.label}
              {shortcut.count !== undefined && shortcut.count > 0 && <span className="font-normal text-ink-muted tabular-nums">{shortcut.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
