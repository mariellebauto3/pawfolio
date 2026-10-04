"use client";

import Form from "next/form";
import { useId } from "react";
import { CONTROL_CLASSES } from "@/components/forms/control-styles";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { QUEUE_SEARCH_MAX, QUEUE_SEARCH_PARAM, QUEUE_TAB_PARAM } from "@/lib/auth/verification-review";
import { cn } from "@/lib/utils/cn";
import type { VerifiedRole } from "@/types/verification-review";

type Props = {
  /** The name being searched for now, shown in the box. */
  search?: string;
  /** The open tab, so a search stays inside it. */
  role?: VerifiedRole;
};

// "Search by name" on the verification queue (AU-22): Enter → ?q=…, read by the page on the server. next/form
// navigates on the client and still works before the page's JavaScript has loaded.
export function VerificationSearch({ search, role }: Props) {
  const inputId = useId();

  return (
    <Form action={ROUTES.adminVerification} role="search" className="relative w-full md:w-64">
      <label htmlFor={inputId} className="sr-only">
        Search the queue by name
      </label>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" />
      {role && <input type="hidden" name={QUEUE_TAB_PARAM} value={role} />}
      <input
        // Remounted when the search changes from outside the box ("Clear search"), so it shows the new value.
        key={search ?? ""}
        id={inputId}
        name={QUEUE_SEARCH_PARAM}
        type="search"
        defaultValue={search}
        placeholder="Search by name"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={QUEUE_SEARCH_MAX}
        className={cn(CONTROL_CLASSES, "pl-10")}
      />
    </Form>
  );
}
