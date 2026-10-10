import Link from "next/link";
import { Table, type TableColumn } from "@/components/data-display/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/navigation/pagination";
import { Tabs } from "@/components/navigation/tabs";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { StatusBadge } from "@/components/ui/status-badge";
import { PET_STATUS_NAMES } from "@/constants/pets";
import { ROUTES, adminAccountPath, adminResolvePath } from "@/constants/routes";
import { ACCOUNT_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/utils/format-date";
import type { Paginated } from "@/types/api";
import { ACCOUNT_PAGE_PARAM, ACCOUNT_TABS, ACCOUNT_TAB_PARAM, type AccountFilters } from "../schemas/accounts";
import type { AccountSummary } from "../types/accounts";

type Props = {
  accounts: Paginated<AccountSummary>;
  filters: AccountFilters;
  /** The page's own query, so the page links keep the tab and the filters. */
  searchParams: Record<string, string | string[] | undefined>;
};

const cityOf = (account: AccountSummary) => account.pet?.city ?? account.home_profile?.city ?? null;

const name: TableColumn<AccountSummary> = {
  key: "name",
  header: "Name",
  rowHeader: true,
  cell: (account) => (
    <span className="flex items-center gap-3">
      <Avatar name={account.display_name} src={account.avatar_url ?? undefined} alt="" size="sm" />
      <span className="flex min-w-0 flex-col">
        {/* Also a link: on phones the View button is a sideways scroll away. */}
        <Link href={adminAccountPath(account.id)} className="underline hover:text-primary">
          {account.display_name}
        </Link>
        {account.caretaker_name && <span className="text-sm font-normal text-ink-muted">Caretaker: {account.caretaker_name}</span>}
      </span>
    </span>
  ),
};

const type: TableColumn<AccountSummary> = { key: "type", header: "Type", cell: (account) => (account.role === "pet" ? "Pet" : "Human") };
const status: TableColumn<AccountSummary> = { key: "status", header: "Account status", cell: (account) => <StatusBadge status={ACCOUNT_STATUS_LABELS[account.status]} /> };
const city: TableColumn<AccountSummary> = { key: "city", header: "City", cell: (account) => cityOf(account) ?? <span className="text-ink-muted">Not set</span> };

const view: TableColumn<AccountSummary> = {
  key: "view",
  header: "View",
  headerHidden: true,
  align: "end",
  cell: (account) => (
    <Link href={adminAccountPath(account.id)} className={buttonClasses({ size: "sm" })}>
      View<span className="sr-only"> {account.display_name}</span>
    </Link>
  ),
};

/** What the account is on the platform, beside its account status: a pet's adoption status, a human's Furparent label. */
function label(account: AccountSummary) {
  if (account.pet?.status) return <StatusBadge status={PET_STATUS_NAMES[account.pet.status]} />;
  if (account.home_profile?.is_furparent) return <StatusBadge status="Furparent" />;
  return <span className="text-ink-muted">None</span>;
}

const COLUMNS: TableColumn<AccountSummary>[] = [name, type, status, { key: "label", header: "Label", cell: label }, city, view];

// An adopted pet that was returned is the issue Resolve exists for (AL-09 → AL-07), so its row leads there as well.
const viewOrResolve: TableColumn<AccountSummary> = {
  key: "actions",
  header: "Actions",
  headerHidden: true,
  align: "end",
  cell: (account) => (
    <span className="flex items-center justify-end gap-2">
      <Link href={adminAccountPath(account.id)} className={buttonClasses({ size: "sm" })}>
        View<span className="sr-only"> {account.display_name}</span>
      </Link>
      {account.pet && (
        <Link href={adminResolvePath(account.pet.id)} className={buttonClasses({ size: "sm", variant: "tertiary" })}>
          Resolve issue<span className="sr-only"> for {account.display_name}</span>
        </Link>
      )}
    </span>
  ),
};

// The Alumni tab lists adopted pets, so the label gives way to who adopted them and when.
const ALUMNI_COLUMNS: TableColumn<AccountSummary>[] = [
  name,
  status,
  {
    key: "furparent",
    header: "Furparent",
    wrap: true,
    cell: ({ adoption }) =>
      adoption?.furparent_name ? (
        <span className="flex flex-col">
          {adoption.furparent_name}
          {adoption.adopted_at && (
            <span className="text-sm text-ink-muted">
              since <time dateTime={adoption.adopted_at}>{formatDate(adoption.adopted_at)}</time>
            </span>
          )}
        </span>
      ) : (
        <span className="text-ink-muted">Not linked</span>
      ),
  },
  city,
  viewOrResolve,
];

function summary(total: number, { tab, search, status: statusFilter }: AccountFilters): string {
  const what = tab === "alumni" ? (total === 1 ? "alumni profile" : "alumni profiles") : total === 1 ? "account" : "accounts";
  const filtered = [search && `matching “${search}”`, statusFilter && `that ${total === 1 ? "is" : "are"} ${ACCOUNT_STATUS_LABELS[statusFilter]}`].filter(Boolean).join(", ");
  return filtered ? `${total} ${what} ${filtered}` : `${total} ${what}`;
}

// The accounts list (AC-06): every Pet and Human account, newest first, by tab, with the search, the status filter
// and the pages kept in the URL. Admin accounts are never listed. Only the open tab's rows are loaded; the page
// re-renders on a tab change.
export function AccountsList({ accounts, filters, searchParams }: Props) {
  const filtered = Boolean(filters.search || filters.status);
  const clear = { pathname: ROUTES.adminAccounts, query: filters.tab === "all" ? {} : { [ACCOUNT_TAB_PARAM]: filters.tab } };

  const empty = filtered ? (
    <EmptyState
      icon="search"
      title="No accounts match these filters"
      description="Check the spelling, search by a pet's name, a human's name or an email, or take the status filter off."
      action={
        <Link href={clear} className={buttonClasses()}>
          Clear filters
        </Link>
      }
    />
  ) : (
    <EmptyState
      icon="inbox"
      title={filters.tab === "alumni" ? "No pets have been adopted yet" : "No accounts yet"}
      description={filters.tab === "alumni" ? "A pet shows up here once a human adopts it on Pawfolio." : "Accounts show up here as soon as someone signs up."}
    />
  );

  const panel = (
    <div className="flex flex-col gap-4">
      {accounts.meta.total > 0 && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          {summary(accounts.meta.total, filters)}
          {filtered && (
            <Link href={clear} className="font-bold text-primary underline hover:text-primary-hover">
              Clear filters
            </Link>
          )}
        </p>
      )}
      <Table
        caption={filters.tab === "alumni" ? "Alumni profiles" : "Accounts"}
        columns={filters.tab === "alumni" ? ALUMNI_COLUMNS : COLUMNS}
        rows={accounts.data}
        rowKey={(account) => account.id}
        empty={empty}
      />
      <Pagination page={accounts.meta.current_page} totalPages={accounts.meta.last_page} searchParams={searchParams} param={ACCOUNT_PAGE_PARAM} label="Pages of accounts" />
    </div>
  );

  return (
    <Tabs
      label="Account type"
      param={ACCOUNT_TAB_PARAM}
      resetParams={[ACCOUNT_PAGE_PARAM]}
      tabs={ACCOUNT_TABS.map((tab) => ({ ...tab, content: tab.id === filters.tab ? panel : undefined }))}
    />
  );
}
