import Link from "next/link";
import { StatTile, StatTiles } from "@/components/data-display/stat-tile";
import { Banner } from "@/components/feedback/banner";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { dayLabel, plural, thisWeekNote, totalViews, viewSourceBars } from "../schemas/stats";
import type { PetStats as Stats } from "../types/stats";
import { BarList } from "./bar-list";
import { LineChart } from "./line-chart";
import { RequestHistory } from "./request-history";

type Props = { stats: Stats };

const NOTE_LINK = "font-bold text-primary underline hover:text-primary-hover";

// AN-01 My stats (pet): how the resume is doing. Totals count from the day the account joined; the chart covers the
// last 30 days. The numbers are the pet's own, counted by the API, and none of them names who looked or who saved
// the resume (SEC-PRIV-03).
export function PetStats({ stats }: Props) {
  const { tiles } = stats;
  const recentViews = totalViews(stats.views_over_time);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {stats.pet_status === "draft" && (
        <Banner
          icon="pencil"
          title="Your resume is still a draft"
          actions={
            <Link href={ROUTES.resumeEdit} className={buttonClasses({ variant: "primary", size: "sm" })}>
              Finish my resume
            </Link>
          }
        >
          Homes can’t find me yet, so there is nothing to count. Publish the resume and the views start here.
        </Banner>
      )}

      <StatTiles label="My resume in numbers">
        <StatTile label="Profile views" value={tiles.views.total} note={thisWeekNote(tiles.views.this_week)} />
        <StatTile label="Bookmarked by" value={tiles.bookmarks.total} note={thisWeekNote(tiles.bookmarks.this_week)} />
        <StatTile
          label="Requests sent"
          value={tiles.requests.total}
          note={
            tiles.requests.open > 0 ? (
              <Link href={ROUTES.requests} className={NOTE_LINK}>
                {tiles.requests.open} open
              </Link>
            ) : (
              "None open"
            )
          }
        />
        <StatTile
          label="Invites received"
          value={tiles.invites.total}
          note={
            tiles.invites.live > 0 ? (
              <Link href={ROUTES.invites} className={NOTE_LINK}>
                {tiles.invites.live} to answer
              </Link>
            ) : (
              "None waiting"
            )
          }
        />
      </StatTiles>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card title="Profile views" description={recentViews > 0 ? `${plural(recentViews, "view")} in the last 30 days.` : "No views in the last 30 days."}>
          <LineChart
            label="Profile views per day, last 30 days"
            unit="Views"
            points={stats.views_over_time.map((day) => dayLabel(day.date))}
            series={[{ id: "views", label: "Views", tone: "primary", values: stats.views_over_time.map((day) => day.count) }]}
          />
        </Card>
        <Card title="Where views come from" description="The page a human was on when they opened my resume.">
          {tiles.views.total > 0 ? <BarList label="Views by where they came from" bars={viewSourceBars(stats.views_by_source)} /> : <p className="text-ink-muted">Nobody has opened my resume yet. A view is counted once per visitor per day.</p>}
        </Card>
      </div>

      <RequestHistory role="pet" requests={stats.request_history} total={tiles.requests.total} />
    </div>
  );
}
