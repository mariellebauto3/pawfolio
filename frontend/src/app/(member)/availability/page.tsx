import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/navigation/pagination";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { getPastMeetings, getUpcomingSlots } from "@/features/meet-and-greet/api/slots";
import { AddSlotButton } from "@/features/meet-and-greet/components/add-slot-button";
import { PastMeetings } from "@/features/meet-and-greet/components/past-meetings";
import { UpcomingSlots } from "@/features/meet-and-greet/components/upcoming-slots";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import { pageFromUrl } from "@/lib/utils/page-param";

export const metadata: Metadata = { title: "Meet & Greet availability" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const pageHref = (page: number) => (page > 1 ? `${ROUTES.availability}?page=${page}` : ROUTES.availability);

// MG-01 Meet & Greet availability: the times and places a human offers, soonest first, open or booked, and the
// Meet & Greets already behind them (FR11). Adding a slot opens MG-02. The API lists only the human's own slots
// and decides what can be added or removed (SEC-FE-05).
export default async function AvailabilityPage({ searchParams }: Props) {
  const account = await requireAccount(ROUTES.availability);
  // Only a human offers slots; a pet books them from its request.
  if (account.role !== "human") redirect(homePathFor(account));

  const page = pageFromUrl((await searchParams).page);
  const client = await getServerApi();
  const [upcoming, past] = await Promise.all([getUpcomingSlots(client, page), getPastMeetings(client)]);
  // A page past the end, such as after the last slot on it was removed: the last page there is now.
  if (upcoming.data.length === 0 && upcoming.meta.total > 0 && upcoming.meta.current_page > upcoming.meta.last_page) {
    redirect(pageHref(upcoming.meta.last_page));
  }

  return (
    <div className="mx-auto w-full max-w-narrow">
      <PageHeader
        title="Meet & Greet availability"
        description="Pets with an approved request can book one of these slots. You confirm each booking."
        actions={upcoming.meta.total > 0 && <AddSlotButton />}
      />

      <div className="flex flex-col gap-4">
        <Card title="Upcoming slots">
          {upcoming.meta.total === 0 ? (
            <EmptyState
              icon="calendar"
              title="No slots yet"
              description="Add the times and places you can meet a pet. A pet you approved books one, and you confirm it."
              action={<AddSlotButton />}
            />
          ) : (
            <>
              <UpcomingSlots slots={upcoming.data} />
              <Pagination page={upcoming.meta.current_page} totalPages={upcoming.meta.last_page} label="Pages of slots" />
            </>
          )}
        </Card>

        <Card title="Past Meet & Greets">
          <PastMeetings meetings={past.data} total={past.meta.total} />
        </Card>

        <p className="flex items-start gap-2 text-sm text-ink-muted">
          <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
          Meet & Greets happen in person. Your phone number and exact address are shared with a pet’s caretaker only after you confirm their booking.
        </p>
      </div>
    </div>
  );
}
