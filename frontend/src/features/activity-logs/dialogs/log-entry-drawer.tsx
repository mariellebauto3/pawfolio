"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { Drawer } from "@/components/overlays/drawer";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { adminAccountPath, adminReportPath, adminRequestPath } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/utils/format-date";
import { getActivityLogEntry } from "../api/activity-logs";
import { ValueChange } from "../components/value-change";
import { ACTIVITY_TYPE_LABELS, ACTOR_ROLE_NAMES, actionLabel, reasonText } from "../schemas/activity-logs";
import type { ActivityEntry, ActivityEntryDetail, ActivityTarget } from "../types/activity-logs";

type Props = {
  /** The entry to show, as the list already has it; null while the drawer is closed. */
  entry: ActivityEntry | null;
  onClose: () => void;
};

type Loaded = { id: number } & ({ detail: ActivityEntryDetail } | { problem: string });

const LINK = "font-bold text-primary underline hover:text-primary-hover";
const TARGET_PATHS: Record<ActivityTarget["kind"], (id: number) => string> = { account: adminAccountPath, request: adminRequestPath, report: adminReportPath };
const TARGET_NAMES: Record<ActivityTarget["kind"], string> = { account: "Open the account", request: "Open the request", report: "Open the report" };

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-bold text-ink-muted">{term}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </div>
  );
}

// LG-04 Log entry detail: one entry in full, for an admin. What the list already knows is shown at once; the rest
// (the device it came from) is asked for when the drawer opens. Read-only: an entry has no edit and no delete,
// here or in the API (SEC-LOG-04). Names and reasons are what people typed, rendered as text (SEC-FE-01).
export function LogEntryDrawer({ entry, onClose }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const entryId = entry?.id ?? null;

  useEffect(() => {
    if (entryId === null) return;
    const controller = new AbortController();
    getActivityLogEntry(api, entryId, { signal: controller.signal }).then(
      (detail) => {
        if (!controller.signal.aborted) setLoaded({ id: entryId, detail });
      },
      (problem: unknown) => {
        if (!controller.signal.aborted) setLoaded({ id: entryId, problem: isApiError(problem) ? problem.message : "We couldn't load the rest of this entry." });
      },
    );
    return () => controller.abort();
  }, [entryId]);

  // Only what was loaded for this entry counts; anything older belongs to the one opened before.
  const current = loaded !== null && loaded.id === entryId ? loaded : null;
  const detail = current && "detail" in current ? current.detail : null;
  const problem = current && "problem" in current ? current.problem : null;
  // The entry itself can't change, so the fuller answer replaces the list's row as soon as it is here.
  const shown = detail ?? entry;

  return (
    <Drawer
      open={entry !== null}
      onClose={onClose}
      title="Log entry"
      subtitle={shown ? <time dateTime={shown.created_at}>{formatDateTime(shown.created_at)}</time> : undefined}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {shown && (
        <div className="flex flex-col gap-4">
          <dl className="divide-y divide-line">
            <Row term="Actor">
              <span className="flex flex-col">
                {shown.actor.id !== null && (shown.actor.role === "pet" || shown.actor.role === "human") ? (
                  <Link href={adminAccountPath(shown.actor.id)} className={`${LINK} self-start`}>
                    {shown.actor.display_name}
                  </Link>
                ) : (
                  <span className="font-bold">{shown.actor.display_name}</span>
                )}
                <span className="text-sm text-ink-muted">
                  {ACTOR_ROLE_NAMES[shown.actor.role]}
                  {shown.actor.is_you && ", you"}
                </span>
              </span>
            </Row>
            <Row term="Action">
              <span className="flex flex-col">
                <span className="font-bold">{actionLabel(shown)}</span>
                <span className="text-sm text-ink-muted">Logged as {shown.action}</span>
              </span>
            </Row>
            <Row term="Type">{ACTIVITY_TYPE_LABELS[shown.type]}</Row>
            <Row term="Target">
              {shown.subject_label ? (
                <span className="flex flex-col gap-1">
                  <span>{shown.subject_label}</span>
                  {shown.target && (
                    <Link href={TARGET_PATHS[shown.target.kind](shown.target.id)} className={`${LINK} self-start text-sm`}>
                      {TARGET_NAMES[shown.target.kind]}
                    </Link>
                  )}
                </span>
              ) : (
                <span className="text-ink-muted">Nothing in particular</span>
              )}
            </Row>
            <Row term="Change">{shown.before_value || shown.after_value ? <ValueChange before={shown.before_value} after={shown.after_value} className="text-base" /> : <span className="text-ink-muted">No value changed</span>}</Row>
            <Row term="Reason">{shown.reason ? <span className="whitespace-pre-line">{reasonText(shown.reason)}</span> : <span className="text-ink-muted">None given</span>}</Row>
            <Row term="Device">
              {problem ? (
                <span className="text-ink-muted">{shown.device ?? "Not loaded"}</span>
              ) : detail ? (
                detail.device || detail.user_agent ? (
                  <span className="flex flex-col gap-1">
                    {detail.device && <span>{detail.device}</span>}
                    {detail.user_agent && <span className="text-sm text-ink-muted">{detail.user_agent}</span>}
                  </span>
                ) : (
                  <span className="text-ink-muted">Not recorded</span>
                )
              ) : (
                <SkeletonGroup label="Loading the device">
                  <Skeleton className="w-2/3" />
                </SkeletonGroup>
              )}
            </Row>
            <Row term="Entry">#{shown.id}</Row>
          </dl>

          {problem && (
            <Alert tone="warning" announce>
              {problem}
            </Alert>
          )}

          <p className="flex items-start gap-2 text-sm text-ink-muted">
            <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
            Log entries can’t be edited or deleted.
          </p>
        </div>
      )}
    </Drawer>
  );
}
