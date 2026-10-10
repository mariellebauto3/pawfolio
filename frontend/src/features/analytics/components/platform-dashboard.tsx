import Link from "next/link";
import { StatTile, StatTiles } from "@/components/data-display/stat-tile";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { accountStatusSegments, averageDays, monthLabels, oldestWaitNote, petStatusBars, plural, waitingNames } from "../schemas/stats";
import type { PlatformDashboard as Dashboard } from "../types/stats";
import { BarList } from "./bar-list";
import { ColumnChart } from "./column-chart";
import { LineChart } from "./line-chart";
import { StackedBar } from "./stacked-bar";

type Props = { dashboard: Dashboard };

const OVERDUE_HREF = `${ROUTES.adminRequests}?tab=overdue`;

type Waiting = { id: string; count: number; text: string; detail?: string; href: string; action: string };

// AN-03 Platform dashboard: the platform as it stands now, how requests and adoptions moved over the last six
// months, and what waits for an admin. Counts only, read-only: no row here carries a document, a phone number or an
// address (SEC-PRIV-01, SEC-PRIV-02), and names are rendered as text (SEC-FE-01).
export function PlatformDashboard({ dashboard }: Props) {
  const { tiles, trends } = dashboard;
  const months = monthLabels(trends);
  const pending = dashboard.needs_attention.pending_verifications;

  const waiting: Waiting[] = [
    {
      id: "verification",
      count: tiles.verification_queue_count,
      text: `${plural(tiles.verification_queue_count, "account")} waiting for verification`,
      detail: waitingNames(pending.map((account) => account.display_name), tiles.verification_queue_count),
      href: ROUTES.adminVerification,
      action: "Review",
    },
    { id: "reports", count: tiles.open_reports_count, text: plural(tiles.open_reports_count, "open report"), href: ROUTES.adminReports, action: "Review" },
    {
      id: "overdue",
      count: tiles.requests.overdue,
      text: `${plural(tiles.requests.overdue, "request")} overdue for a decision`,
      detail: "No Adopt or Decline 7 days after the meeting time.",
      href: OVERDUE_HREF,
      action: "Open",
    },
  ].filter((row) => row.count > 0);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <StatTiles label="The platform in numbers">
        <StatTile label="Active accounts" value={tiles.accounts.active} note={`${plural(tiles.accounts.active_pets, "pet")} and ${plural(tiles.accounts.active_humans, "human")}`} />
        <StatTile label="Verification queue" value={tiles.verification_queue_count} note={oldestWaitNote(tiles.verification_queue_count > 0 ? tiles.oldest_verification_at : null)} />
        <StatTile label="Pets looking for a home" value={tiles.pets_by_status.looking_for_a_home} />
        <StatTile label="Pets in process" value={tiles.pets_by_status.in_process} />
        <StatTile label="Open requests" value={tiles.requests.open} note={tiles.requests.expiring_soon > 0 ? `${tiles.requests.expiring_soon} expiring within 3 days` : "None expiring soon"} />
        <StatTile label="Meet & Greets this week" value={tiles.meet_and_greets.upcoming_week} note="In the next 7 days" />
        <StatTile label="Adoptions this month" value={tiles.adoptions_this_month} note={`${tiles.adoptions_last_month} last month, ${tiles.adoptions_count} in all`} />
        <StatTile label="Average days to adoption" value={averageDays(tiles.average_days_to_adoption)} note={tiles.adoptions_count > 0 ? "From request sent to Adopted" : "No adoptions yet"} />
      </StatTiles>

      <Card title="Needs attention">
        {waiting.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line">
            {waiting.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold">{row.text}</span>
                  {row.detail && <span className="text-sm wrap-break-word text-ink-muted">{row.detail}</span>}
                </span>
                <Link href={row.href} className={buttonClasses({ size: "sm" })}>
                  {row.action}
                  <span className="sr-only">: {row.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-ink-muted">
            <Icon name="circle-check" className="size-5 shrink-0" />
            Nothing is waiting: no account to verify, no open report and no overdue decision.
          </p>
        )}
      </Card>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        <Card title="Adoptions per month" description="The last six months.">
          <ColumnChart label="Adoptions per month" unit="adoption" columns={trends.map((trend, index) => ({ id: trend.month, label: months[index], value: trend.adopted, tone: "accent" }))} />
        </Card>
        <Card title="Accounts by status" description={`${plural(tiles.accounts.total, "Pet and Human account")} in all.`}>
          <StackedBar label="Accounts by status" segments={accountStatusSegments(tiles.accounts)} />
        </Card>
        <Card title="Pets by status">
          <BarList label="Pets by status" bars={petStatusBars(tiles.pets_by_status)} />
        </Card>
        <Card title="Requests per month" description="Requests sent and approved, and adoptions, over the last six months.">
          <LineChart
            label="Requests sent, requests approved and adoptions per month"
            unit="Requests"
            points={months}
            series={[
              { id: "sent", label: "Sent", tone: "primary-light", values: trends.map((trend) => trend.sent) },
              { id: "approved", label: "Approved", tone: "primary", values: trends.map((trend) => trend.approved) },
              { id: "adopted", label: "Adopted", tone: "accent", values: trends.map((trend) => trend.adopted) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
