import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { HOME_TYPE_LABELS } from "@/constants/home-profiles";
import { FEED_COMPOSE_PARAM, FEED_COMPOSE_STORY, ROUTES, homeProfilePath, petPath } from "@/constants/routes";
import { PET_STATUS_LABELS } from "@/constants/statuses";
import { getInvites } from "@/features/adoption-requests/api/invites";
import { getSavedPets } from "@/features/bookmarks/api/bookmarks";
import { getFeed } from "@/features/community-feed/api/feed";
import { Feed } from "@/features/community-feed/components/feed";
import { FeedAnnouncements } from "@/features/community-feed/components/feed-announcements";
import { FeedLayout } from "@/features/community-feed/components/feed-layout";
import { FeedProfileCard } from "@/features/community-feed/components/feed-profile-card";
import { FeedSuggestionsCard, type Suggestion } from "@/features/community-feed/components/feed-suggestions-card";
import type { FeedViewer, StoryPet } from "@/features/community-feed/types/feed";
import { getHomeMatches, getPetMatches } from "@/features/matching/api/matching";
import { ALL_MATCHES } from "@/features/matching/schemas/match-view";
import type { Matches } from "@/features/matching/types/matching";
import { getOwnHomeProfile } from "@/features/profiles/api/home-profile";
import { getOwnPet } from "@/features/profiles/api/resume";
import type { ApiClient } from "@/lib/api/core";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import { formatAgeMonths } from "@/lib/utils/format-age";
import type { Account } from "@/types/account";

export const metadata: Metadata = { title: "Home" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** What stands beside the feed for one account. Every part is an extra: one that can't be read is left out. */
type Rails = {
  profile: ReactNode;
  aside: ReactNode;
  storyPets: StoryPet[];
  avatarUrl: string | null;
};

/** Matches shown beside the feed. */
const SUGGESTIONS = 3;

const settled = <T,>(result: PromiseSettledResult<T>): T | null => (result.status === "fulfilled" ? result.value : null);

const joined = (parts: (string | null | undefined)[]) => parts.filter((part): part is string => typeof part === "string" && part.trim() !== "").join(" · ");

/** The top of a ranked list, or null when the account has matches of its own to show another way (or none to offer). */
function topMatches<T>(matches: Matches<T> | null, toSuggestion: (row: T) => Suggestion): Suggestion[] | null {
  return matches?.eligible ? matches.page.data.slice(0, SUGGESTIONS).map(toSuggestion) : null;
}

// FD-02: the pet's side. The resume gives the mini profile, Homes for You the suggestions, and the invites their count.
async function petRails(api: ApiClient, account: Account): Promise<Rails> {
  const [ownPet, homeMatches, petInvites] = await Promise.allSettled([getOwnPet(api), getHomeMatches(api, ALL_MATCHES), getInvites(api)]);
  const pet = settled(ownPet);
  const matches = settled(homeMatches);
  const invites = settled(petInvites)?.meta.total ?? 0;
  const suggestions = topMatches(matches, ({ score, home_profile: home }) => ({
    id: home.id,
    name: home.full_name,
    place: home.city,
    href: homeProfilePath(home.id),
    photoUrl: home.profile_photo_url,
    score,
  }));

  return {
    storyPets: [],
    avatarUrl: pet?.photos[0]?.url ?? account.avatar_url,
    profile: (
      <FeedProfileCard
        name={pet?.name ?? account.display_name}
        avatarUrl={pet?.photos[0]?.url ?? account.avatar_url}
        line={pet ? joined([pet.breed, formatAgeMonths(pet.approximate_age_months), pet.city]) : undefined}
        badges={pet && <StatusBadge status={PET_STATUS_LABELS[pet.status]} />}
        stats={pet ? [{ label: "Profile views", value: pet.views_count }, { label: "Bookmarked by", value: pet.bookmarks_count }] : []}
        shortcuts={[
          { label: "Bookmarks", href: ROUTES.bookmarks },
          { label: "Invites to Apply", href: ROUTES.invites, count: invites },
          { label: "My stats", href: ROUTES.stats },
        ]}
      />
    ),
    aside: (
      <>
        {suggestions ? (
          <FeedSuggestionsCard kind="homes" suggestions={suggestions} />
        ) : (
          matches?.eligible === false &&
          matches.reason === "resume_draft" && (
            <FeedSuggestionsCard kind="homes" suggestions={[]} notReady={{ message: "Publish your resume to see the homes that fit you.", action: "Finish my resume", href: ROUTES.resumeEdit }} />
          )
        )}
        {invites > 0 && (
          <Card
            title="Invites to Apply"
            titleAs="h2"
            action={
              <Link href={ROUTES.invites} className="text-sm font-bold text-primary hover:underline">
                View
                <span className="sr-only"> your invites</span>
              </Link>
            }
          >
            <p className="text-sm">{invites === 1 ? "1 home invited you to apply." : `${invites} homes invited you to apply.`}</p>
          </Card>
        )}
      </>
    ),
  };
}

// FD-01: the human's side. The Home Profile gives the mini profile and the adopted pets a story can be told about
// (FD-04), Pets for You the suggestions.
async function humanRails(api: ApiClient, account: Account): Promise<Rails> {
  const [ownHome, petMatches, savedPets] = await Promise.allSettled([getOwnHomeProfile(api), getPetMatches(api, ALL_MATCHES), getSavedPets(api)]);
  const home = settled(ownHome);
  const matches = settled(petMatches);
  const saved = settled(savedPets);
  const suggestions = topMatches(matches, ({ score, pet }) => ({ id: pet.id, name: pet.name, place: pet.city, href: petPath(pet.id), photoUrl: pet.photos[0]?.url ?? null, score }));

  return {
    storyPets: (home?.adopted_pets ?? []).map(({ adopted_at, pet }) => ({ id: pet.id, name: pet.name, adoptedAt: adopted_at })),
    avatarUrl: home?.profile_photo_url ?? account.avatar_url,
    profile: (
      <FeedProfileCard
        name={home?.full_name ?? account.display_name}
        avatarUrl={home?.profile_photo_url ?? account.avatar_url}
        line={home ? joined([home.city, home.home_type && HOME_TYPE_LABELS[home.home_type]]) : undefined}
        badges={
          home &&
          (home.is_open_to_adopt || home.is_furparent) && (
            <>
              {home.is_open_to_adopt && <StatusBadge status="Open to Adopt" />}
              {home.is_furparent && <StatusBadge status="Furparent" />}
            </>
          )
        }
        stats={[...(home ? [{ label: "Profile views", value: home.views_count }] : []), ...(saved ? [{ label: "Saved pets", value: saved.meta.total }] : [])]}
        shortcuts={[
          { label: "Bookmarks", href: ROUTES.bookmarks },
          { label: "Meet & Greet availability", href: ROUTES.availability },
          { label: "Match & request history", href: ROUTES.stats },
        ]}
      />
    ),
    aside: suggestions ? (
      <FeedSuggestionsCard kind="pets" suggestions={suggestions} />
    ) : (
      matches?.eligible === false && (
        <FeedSuggestionsCard kind="pets" suggestions={[]} notReady={{ message: "Take the lifestyle quiz to see the pets that fit your home.", action: "Take the lifestyle quiz", href: ROUTES.homeProfileEdit }} />
      )
    ),
  };
}

// FD-01 Community feed (human) and FD-02 (pet): one feed for everyone, newest first, with For Hire posts, pet
// updates, human posts, Hired posts and adoption stories together. It is separate from the ranked matches, which
// only appear as the few suggestions beside it. The API lists what an Active account may read (SEC-AUTHZ-06) and
// decides everything the feed can do; the rails are extras read from the account's own profile.
export default async function FeedPage({ searchParams }: Props) {
  const [params, account] = await Promise.all([searchParams, requireAccount(ROUTES.memberHome)]);
  // The feed is a member page: an admin's home is the dashboard.
  if (account.role === "admin") redirect(homePathFor(account));

  const api = await getServerApi();
  const [feed, rails] = await Promise.all([getFeed(api), account.role === "pet" ? petRails(api, account) : humanRails(api, account)]);
  const viewer: FeedViewer = { id: account.id, role: account.role, name: account.display_name, avatarUrl: rails.avatarUrl };

  return (
    <>
      <h1 className="sr-only">Home feed</h1>
      <FeedLayout
        profile={rails.profile}
        aside={
          <>
            {rails.aside}
            <FeedAnnouncements announcements={feed.announcements} />
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* The side rail is hidden on a phone, so the latest announcement is read above the posts there. */}
          <FeedAnnouncements announcements={feed.announcements} limit={1} className="lg:hidden" />
          <Feed
            initial={feed}
            viewer={viewer}
            storyPets={rails.storyPets}
            compose={params[FEED_COMPOSE_PARAM] === FEED_COMPOSE_STORY ? "story" : undefined}
            renderedAt={new Date().toISOString()}
          />
        </div>
      </FeedLayout>
    </>
  );
}
