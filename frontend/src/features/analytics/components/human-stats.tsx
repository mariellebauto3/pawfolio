import Link from "next/link";
import { StatTile, StatTiles } from "@/components/data-display/stat-tile";
import { EmptyState } from "@/components/feedback/empty-state";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { requestOutcomeBars, scoreBandColumns } from "../schemas/stats";
import type { HumanStats as Stats } from "../types/stats";
import { BarList } from "./bar-list";
import { ColumnChart } from "./column-chart";
import { RequestHistory } from "./request-history";

type Props = { stats: Stats };

const NOTE_LINK = "font-bold text-primary underline hover:text-primary-hover";

// AN-02 Match & request history (human): the pets on Pets for You by how well they match, and the requests the
// home received by how they ended. The numbers are the human's own, counted by the API (FR5, FR10).
export function HumanStats({ stats }: Props) {
  const { tiles } = stats;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <StatTiles label="My matches and requests in numbers">
        <StatTile
          label="Pets matched"
          value={tiles.matches.total}
          note={
            tiles.matches.total > 0 ? (
              <Link href={ROUTES.matches} className={NOTE_LINK}>
                {tiles.matches.strong} at 80% or more
              </Link>
            ) : (
              "None yet"
            )
          }
        />
        <StatTile
          label="Pets bookmarked"
          value={tiles.bookmarks.total}
          note={
            tiles.bookmarks.total > 0 ? (
              <Link href={ROUTES.bookmarks} className={NOTE_LINK}>
                See bookmarks
              </Link>
            ) : (
              "None saved"
            )
          }
        />
        <StatTile
          label="Requests received"
          value={tiles.requests.total}
          note={
            tiles.requests.need_action > 0 ? (
              <Link href={ROUTES.requests} className={NOTE_LINK}>
                {tiles.requests.need_action} waiting on you
              </Link>
            ) : (
              "None waiting on you"
            )
          }
        />
        {/* Names of the human's own adopted pets, as text (SEC-FE-01). */}
        <StatTile label="Pets adopted" value={tiles.adopted.total} note={tiles.adopted.names.length > 0 ? tiles.adopted.names.join(", ") : "None yet"} />
      </StatTiles>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card title="Match scores" description="The pets on Pets for You, by how well they fit your home.">
          {tiles.matches.total > 0 ? (
            <ColumnChart label="Pets by match score" unit="pet" columns={scoreBandColumns(stats.match_score_distribution)} />
          ) : stats.has_completed_quiz ? (
            <EmptyState icon="search" title="No matches right now" description="Pets that fit your answers show up as they publish their resumes." />
          ) : (
            <EmptyState
              icon="search"
              title="No matches yet"
              description="Matches come from your lifestyle quiz. It takes a few minutes."
              action={
                <Link href={ROUTES.homeProfileEdit} className={buttonClasses({ variant: "primary" })}>
                  Take the lifestyle quiz
                </Link>
              }
            />
          )}
        </Card>
        <Card title="Requests by outcome" description="Every request your home received, by where it stands.">
          {tiles.requests.total > 0 ? <BarList label="Requests by outcome" bars={requestOutcomeBars(stats.request_outcomes)} /> : <p className="text-ink-muted">No pet has applied yet.</p>}
        </Card>
      </div>

      <RequestHistory role="human" requests={stats.request_history} total={tiles.requests.total} />
    </div>
  );
}
