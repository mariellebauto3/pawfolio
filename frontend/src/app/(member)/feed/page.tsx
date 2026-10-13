import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { HOME_TYPE_LABELS } from "@/constants/home-profiles";
import { FEED_COMPOSE_PARAM, FEED_COMPOSE_STORY, ROUTES } from "@/constants/routes";
import { PET_STATUS_LABELS } from "@/constants/statuses";
import { getFeed, getFeedSuggestions } from "@/features/community-feed/api/feed";
import { Feed } from "@/features/community-feed/components/feed";
import { FeedAnnouncements } from "@/features/community-feed/components/feed-announcements";
import { FeedLayout } from "@/features/community-feed/components/feed-layout";
import { FeedProfileCard } from "@/features/community-feed/components/feed-profile-card";
import { FeedSuggestionsCard } from "@/features/community-feed/components/feed-suggestions-card";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import { formatAgeMonths } from "@/lib/utils/format-age";

export const metadata: Metadata = { title: "Home" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Suggestions({ role, pending }: { role: "pet" | "human"; pending: ReturnType<typeof getFeedSuggestions> }) {
  const matches = await pending;
  if (matches.reason === "unavailable" || matches.reason === "already_adopted") return null;
  const notReady = matches.reason === "resume_draft"
    ? { message: "Publish your resume to see the homes that fit you.", action: "Finish my resume", href: ROUTES.resumeEdit }
    : matches.reason === "quiz_incomplete"
      ? { message: "Take the lifestyle quiz to see the pets that fit your home.", action: "Take the lifestyle quiz", href: ROUTES.homeProfileEdit }
      : undefined;
  return <FeedSuggestionsCard kind={role === "pet" ? "homes" : "pets"} suggestions={matches.items} notReady={notReady} />;
}

// The first batch carries the small home cards and counts. Suggestions stream independently;
// Home never loads the other modules' full profiles, invitations or bookmarks lists.
export default async function FeedPage({ searchParams }: Props) {
  const [params, account] = await Promise.all([searchParams, requireAccount(ROUTES.memberHome)]);
  if (account.role === "admin") redirect(homePathFor(account));
  const role = account.role;
  const api = await getServerApi();
  const pendingFeed = getFeed(api, { pagination: "cursor", includeHome: true });
  const suggestions = getFeedSuggestions(api, role).catch(() => ({ items: [], reason: "unavailable" }));
  const feed = await pendingFeed;
  const home = feed.home;
  const avatarUrl = home?.avatar_url ?? account.avatar_url;
  const invites = home?.invites_count ?? 0;
  const line = role === "pet"
    ? [home?.breed, home?.approximate_age_months != null ? formatAgeMonths(home.approximate_age_months) : null, home?.city]
    : [home?.city, home?.home_type ? HOME_TYPE_LABELS[home.home_type] : null];
  const profile = (
    <FeedProfileCard
      name={home?.name ?? account.display_name}
      avatarUrl={avatarUrl}
      line={line.filter(Boolean).join(" · ") || undefined}
      badges={role === "pet"
        ? home?.pet_status && <StatusBadge status={PET_STATUS_LABELS[home.pet_status]} />
        : <>{home?.is_open_to_adopt && <StatusBadge status="Open to Adopt" />}{home?.is_furparent && <StatusBadge status="Furparent" />}</>}
      stats={home ? [{ label: "Profile views", value: home.views_count }, role === "pet"
        ? { label: "Bookmarked by", value: home.bookmarks_count }
        : { label: "Saved pets", value: home.saved_pets_count }] : []}
      shortcuts={role === "pet" ? [
        { label: "Bookmarks", href: ROUTES.bookmarks },
        { label: "Invites to Apply", href: ROUTES.invites, count: invites },
        { label: "My stats", href: ROUTES.stats },
      ] : [
        { label: "Bookmarks", href: ROUTES.bookmarks },
        { label: "Meet & Greet availability", href: ROUTES.availability },
        { label: "Match & request history", href: ROUTES.stats },
      ]}
    />
  );
  return (
    <>
      <h1 className="sr-only">Home feed</h1>
      <FeedLayout profile={profile} aside={<>
        <Suspense fallback={<SkeletonGroup label="Loading suggestions"><Skeleton shape="block" className="h-40" /></SkeletonGroup>}>
          <Suggestions role={role} pending={suggestions} />
        </Suspense>
        {role === "pet" && invites > 0 && <Card title="Invites to Apply" titleAs="h2" action={<Link prefetch={false} href={ROUTES.invites} className="text-sm font-bold text-primary hover:underline">View<span className="sr-only"> your invites</span></Link>}>
          <p className="text-sm">{invites === 1 ? "1 home invited you to apply." : `${invites} homes invited you to apply.`}</p>
        </Card>}
        <FeedAnnouncements announcements={feed.announcements} />
      </>}>
        <div className="flex flex-col gap-4">
          <FeedAnnouncements announcements={feed.announcements} limit={1} className="lg:hidden" />
          <Feed initial={feed} viewer={{ id: account.id, role, name: account.display_name, avatarUrl }}
            storyPets={home?.story_pets ?? []} compose={params[FEED_COMPOSE_PARAM] === FEED_COMPOSE_STORY ? "story" : undefined}
            renderedAt={new Date().toISOString()} />
        </div>
      </FeedLayout>
    </>
  );
}
