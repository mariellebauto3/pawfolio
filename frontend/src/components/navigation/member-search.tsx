"use client";

import Form from "next/form";
import { useId } from "react";
import { CONTROL_CLASSES } from "@/components/forms/control-styles";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { Role } from "@/types/statuses";

/** The `/search` query parameter (DS-03). */
export const SEARCH_QUERY_PARAM = "q";

type Props = {
  role: Role | null;
  className?: string;
};

// Top-bar search (GN-01): Enter → /search?q=… (DS-03). next/form navigates on the client and still works before the
// page's JavaScript has loaded. The query is search terms only, so it's fine in the URL (unlike personal data,
// SEC-FE-04).
export function MemberSearch({ role, className }: Props) {
  const inputId = useId();
  const placeholder = role === "pet" ? "Search homes, pets, posts" : "Search pets, people, posts";

  return (
    <Form action={ROUTES.search} role="search" className={cn("relative", className)}>
      <label htmlFor={inputId} className="sr-only">
        Search Pawfolio
      </label>
      <Icon
        name="search"
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted"
      />
      <input
        id={inputId}
        name={SEARCH_QUERY_PARAM}
        type="search"
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        maxLength={100}
        className={cn(CONTROL_CLASSES, "pl-10")}
      />
    </Form>
  );
}
