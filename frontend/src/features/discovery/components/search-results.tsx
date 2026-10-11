import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/navigation/pagination";
import { Tabs } from "@/components/navigation/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { HOME_TYPE_LABELS, householdSummary } from "@/constants/home-profiles";
import { PET_STATUS_NAMES, SPECIES_LABELS } from "@/constants/pets";
import { ROUTES, homeProfilePath, petPath, postPath } from "@/constants/routes";
import { formatAgeMonths } from "@/lib/utils/format-age";
import { formatDate } from "@/lib/utils/format-date";
import type { PaginationMeta } from "@/types/api";
import type { HomeProfile } from "@/types/home-profile";
import type { Pet } from "@/types/pet";
import type { Role } from "@/types/statuses";
import { SEARCH_PAGE_PARAM, SEARCH_PARAM, SEARCH_TYPE_PARAM, type SearchKind, searchHref } from "../schemas/search";
import type { PostType, SearchPost, SearchResults as Results } from "../types/discovery";

type Props = {
  results: Results;
  /** Chooses which kind comes first and what the matches list is called. */
  role: Role;
};

const POST_TYPE_LABELS = {
  for_hire: "For Hire",
  hired: "Hired",
  update: "Update",
  post: "Post",
  adoption_story: "Adoption story",
} as const satisfies Record<PostType, string>;

const KIND_LABELS = { pets: "Pets", homes: "Homes", posts: "Posts" } as const satisfies Record<SearchKind, string>;

type SectionProps = {
  kind: SearchKind;
  /** How many there are in all, not only the ones listed here. */
  total: number;
  /** Under the list: "See all 31 pets" on the overview, the page links on a kind's own tab. */
  footer?: ReactNode;
  children: ReactNode;
};

function Section({ kind, total, footer, children }: SectionProps) {
  return (
    <Card title={`${KIND_LABELS[kind]} (${total})`} as="section">
      <ul className="flex flex-col divide-y divide-line">{children}</ul>
      {footer}
    </Card>
  );
}

const ROW = "flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0";
const NAME = "font-bold underline-offset-4 hover:underline";

function PetRow({ pet }: { pet: Pet }) {
  const facts = [SPECIES_LABELS[pet.species], pet.breed, formatAgeMonths(pet.approximate_age_months), pet.city].filter(Boolean);
  return (
    <li className={ROW}>
      <Avatar name={pet.name} src={pet.photos[0]?.url} alt="" size="lg" />
      <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
        <Link href={petPath(pet.id)} className={NAME}>
          {pet.name}
        </Link>
        <span className="text-sm text-ink-muted">{facts.join(" · ")}</span>
        <span>
          <StatusBadge status={PET_STATUS_NAMES[pet.status]} />
        </span>
      </div>
      <Link href={petPath(pet.id)} className={buttonClasses({ size: "sm" })}>
        View resume<span className="sr-only"> of {pet.name}</span>
      </Link>
    </li>
  );
}

function HomeRow({ home }: { home: HomeProfile }) {
  const facts = [home.home_type && HOME_TYPE_LABELS[home.home_type], householdSummary(home), home.city].filter(Boolean);
  return (
    <li className={ROW}>
      <Avatar name={home.full_name} src={home.profile_photo_url ?? undefined} alt="" size="lg" />
      <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
        <Link href={homeProfilePath(home.id)} className={NAME}>
          {home.full_name}
        </Link>
        <span className="text-sm text-ink-muted">{facts.join(" · ")}</span>
        {(home.is_open_to_adopt || home.is_furparent) && (
          <span className="flex flex-wrap gap-2">
            {home.is_open_to_adopt && <StatusBadge status="Open to Adopt" />}
            {home.is_furparent && <StatusBadge status="Furparent" />}
          </span>
        )}
      </div>
      <Link href={homeProfilePath(home.id)} className={buttonClasses({ size: "sm" })}>
        View profile<span className="sr-only"> of {home.full_name}</span>
      </Link>
    </li>
  );
}

function PostRow({ post }: { post: SearchPost }) {
  // A post is found by its title or its text; show whichever it has, the title first.
  const text = [post.title, post.body].filter((part): part is string => Boolean(part?.trim()));
  return (
    <li className={ROW}>
      <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1">
        <Link href={postPath(post.id)} className={`${NAME} line-clamp-2`}>
          {text[0] ?? "Post"}
        </Link>
        {text[1] && <span className="line-clamp-2 text-sm">{text[1]}</span>}
        <span className="text-sm text-ink-muted">
          {[post.author_name, post.created_at && formatDate(post.created_at)].filter(Boolean).join(" · ")}
        </span>
      </div>
      <Badge tone={post.type === "hired" ? "celebrate" : "progress"}>{POST_TYPE_LABELS[post.type]}</Badge>
    </li>
  );
}

const petRows = (pets: Pet[]) => pets.map((pet) => <PetRow key={pet.id} pet={pet} />);
const homeRows = (homes: HomeProfile[]) => homes.map((home) => <HomeRow key={home.id} home={home} />);
const postRows = (posts: SearchPost[]) => posts.map((post) => <PostRow key={post.id} post={post} />);

function pageSummary({ total, from, to }: PaginationMeta): string | null {
  return from !== null && to !== null && to - from + 1 < total ? `Showing ${from} to ${to} of ${total}` : null;
}

// DS-03 Search results across pets, homes and posts, and DS-04 when nothing is found. "All" shows the first few of
// each kind; a kind's own tab lists all of them a page at a time. The tab counts are the real totals. The open kind
// and its page live in the URL (?type=pets&page=2). Names, headlines and posts are typed by users and rendered as
// plain text (SEC-FE-01). The API leaves out Drafts, adopted pets and homes that aren't Open to Adopt.
export function SearchResults({ results, role }: Props) {
  const { query, totals, view } = results;
  const total = totals.pets + totals.homes + totals.posts;

  if (total === 0) {
    return (
      <Card>
        <EmptyState
          icon="search"
          title={`No results for “${query}”`}
          description="Check the spelling, or try a broader word such as a species (“dog”), a breed (“aspin”) or a city."
          action={
            role !== "admin" && (
              <Link href={ROUTES.matches} className={buttonClasses({ variant: "primary" })}>
                {role === "pet" ? "See Homes for You" : "See Pets for You"}
              </Link>
            )
          }
          secondaryAction={
            <Link href={ROUTES.browse} className={buttonClasses()}>
              Browse all
            </Link>
          }
        />
      </Card>
    );
  }

  // What the account came to find goes first: homes for a pet, pets for everyone else.
  const order: SearchKind[] = role === "pet" ? ["homes", "pets", "posts"] : ["pets", "homes", "posts"];

  let panel: ReactNode;
  if (view.kind === "all") {
    const rows = { pets: petRows(view.pets), homes: homeRows(view.homes), posts: postRows(view.posts) };
    panel = (
      <div className="flex flex-col gap-6">
        {order
          .filter((kind) => rows[kind].length > 0)
          .map((kind) => (
            <Section
              key={kind}
              kind={kind}
              total={totals[kind]}
              footer={
                totals[kind] > rows[kind].length && (
                  <Link href={searchHref(query, kind)} className="self-start text-sm font-bold text-primary underline hover:text-primary-hover">
                    See all {totals[kind]} {KIND_LABELS[kind].toLowerCase()}
                  </Link>
                )
              }
            >
              {rows[kind]}
            </Section>
          ))}
      </div>
    );
  } else if (view.page.meta.total === 0) {
    panel = (
      <EmptyState
        icon="search"
        title={`No ${KIND_LABELS[view.kind].toLowerCase()} match “${query}”`}
        description="The other tabs have results for this search."
      />
    );
  } else {
    const { meta } = view.page;
    const summary = pageSummary(meta);
    panel = (
      <Section
        kind={view.kind}
        total={meta.total}
        footer={
          <>
            {summary && (
              <p role="status" className="text-sm text-ink-muted">
                {summary}
              </p>
            )}
            <Pagination
              page={meta.current_page}
              totalPages={meta.last_page}
              searchParams={{ [SEARCH_PARAM]: query, [SEARCH_TYPE_PARAM]: view.kind }}
              param={SEARCH_PAGE_PARAM}
              label={`Pages of ${KIND_LABELS[view.kind].toLowerCase()}`}
            />
          </>
        }
      >
        {view.kind === "pets" ? petRows(view.page.data) : view.kind === "homes" ? homeRows(view.page.data) : postRows(view.page.data)}
      </Section>
    );
  }

  // Only the open tab's results are loaded; the page re-renders with another kind's when its tab is chosen.
  return (
    <Tabs
      label="Kind of result"
      param={SEARCH_TYPE_PARAM}
      resetParams={[SEARCH_PAGE_PARAM]}
      tabs={[
        { id: "all", label: "All", count: total, content: view.kind === "all" ? panel : undefined },
        ...order.map((kind) => ({ id: kind, label: KIND_LABELS[kind], count: totals[kind], content: view.kind === kind ? panel : undefined })),
      ]}
    />
  );
}
