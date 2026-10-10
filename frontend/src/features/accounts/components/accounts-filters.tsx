"use client";

import Form from "next/form";
import { useId } from "react";
import { CONTROL_CLASSES } from "@/components/forms/control-styles";
import { Select } from "@/components/forms/select";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { ACCOUNT_SEARCH_MAX, ACCOUNT_SEARCH_PARAM, ACCOUNT_STATUS_OPTIONS, ACCOUNT_STATUS_PARAM, ACCOUNT_TAB_PARAM, type AccountFilters } from "../schemas/accounts";

type Props = {
  /** What the list is filtered by now, shown in the controls. */
  filters: AccountFilters;
};

// "Search accounts" and the status filter on the accounts list (AC-06): Enter, or a new status, → ?q=…&status=…,
// read by the page on the server. next/form navigates on the client and still works before the page's JavaScript
// has loaded (the Filter button is there for that, and for a keyboard). The status is a filter of what to list,
// never a way to set one (FR27).
export function AccountsFilters({ filters }: Props) {
  const searchId = useId();
  const statusId = useId();

  return (
    <Form action={ROUTES.adminAccounts} role="search" className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
      {filters.tab !== "all" && <input type="hidden" name={ACCOUNT_TAB_PARAM} value={filters.tab} />}
      <div className="relative w-full md:w-64">
        <label htmlFor={searchId} className="sr-only">
          Search accounts by name or email
        </label>
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" />
        <input
          // Remounted when the search changes from outside the box ("Clear filters"), so it shows the new value.
          key={filters.search ?? ""}
          id={searchId}
          name={ACCOUNT_SEARCH_PARAM}
          type="search"
          defaultValue={filters.search}
          placeholder="Search accounts"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={ACCOUNT_SEARCH_MAX}
          className={cn(CONTROL_CLASSES, "pl-10")}
        />
      </div>
      <div className="w-full md:w-48">
        <label htmlFor={statusId} className="sr-only">
          Account status
        </label>
        <Select
          key={filters.status ?? ""}
          id={statusId}
          name={ACCOUNT_STATUS_PARAM}
          defaultValue={filters.status ?? ""}
          // "All statuses" is a real choice, so a filter can be taken off again.
          options={[{ value: "", label: "All statuses" }, ...ACCOUNT_STATUS_OPTIONS]}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
      </div>
      <button type="submit" className="sr-only focus:not-sr-only focus:min-h-11 focus:rounded-pill focus:px-4 focus:font-bold focus:text-primary">
        Filter
      </button>
    </Form>
  );
}
