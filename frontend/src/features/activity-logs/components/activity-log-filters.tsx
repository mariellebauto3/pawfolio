"use client";

import Form from "next/form";
import { useId } from "react";
import { Select } from "@/components/forms/select";
import { ROUTES } from "@/constants/routes";
import { ACTIVITY_TYPE_LABELS, ACTOR_ROLE_LABELS, LOG_ACTOR_PARAM, LOG_TYPE_PARAM, type LogFilters } from "../schemas/activity-logs";
import { ACTIVITY_TYPES, ACTOR_ROLES } from "../types/activity-logs";

type Props = {
  /** What the log is filtered by now, shown in the controls. */
  filters: LogFilters;
};

// The actor and type filters of the activity logs (LG-03): a new choice → ?actor=…&type=…, read by the page on the
// server. next/form navigates on the client and still works before the page's JavaScript has loaded (the Filter
// button is there for that, and for a keyboard). Only values from these lists are ever sent (SEC-INPUT-03).
export function ActivityLogFilters({ filters }: Props) {
  const actorId = useId();
  const typeId = useId();

  return (
    <Form action={ROUTES.adminActivityLogs} className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
      <div className="w-full md:w-44">
        <label htmlFor={actorId} className="sr-only">
          Who acted
        </label>
        <Select
          // Remounted when the filter changes from outside the control ("Clear filters"), so it shows the new value.
          key={filters.actor ?? ""}
          id={actorId}
          name={LOG_ACTOR_PARAM}
          defaultValue={filters.actor ?? ""}
          // "All actors" is a real choice, so a filter can be taken off again.
          options={[{ value: "", label: "All actors" }, ...ACTOR_ROLES.map((role) => ({ value: role, label: ACTOR_ROLE_LABELS[role] }))]}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
      </div>
      <div className="w-full md:w-48">
        <label htmlFor={typeId} className="sr-only">
          Type of entry
        </label>
        <Select
          key={filters.type ?? ""}
          id={typeId}
          name={LOG_TYPE_PARAM}
          defaultValue={filters.type ?? ""}
          options={[{ value: "", label: "All types" }, ...ACTIVITY_TYPES.map((type) => ({ value: type, label: ACTIVITY_TYPE_LABELS[type] }))]}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
      </div>
      <button type="submit" className="sr-only focus:not-sr-only focus:min-h-11 focus:rounded-pill focus:px-4 focus:font-bold focus:text-primary">
        Filter
      </button>
    </Form>
  );
}
