"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useReport } from "@/providers/report-provider";
import type { ReportTarget } from "@/types/report";

type Props = {
  target: ReportTarget;
  /** What the button says: "Report" beside other actions, where the page already names whose profile it is. */
  label?: string;
};

// Report on a resume or a Home Profile (DS-05, DS-07 → RP-01). The quietest of the page's actions: a text button,
// last in the row. A page shows it only to a pet or a human reading someone else's profile; the API refuses a
// report on one's own (SEC-FE-05).
export function ReportButton({ target, label = "Report" }: Props) {
  const reporting = useReport();
  if (!reporting) return null;

  return (
    <Button variant="tertiary" icon={<Icon name="flag" className="size-4 shrink-0" />} onClick={() => reporting.report(target)}>
      {label}
      <span className="sr-only"> {target.ownerName}</span>
    </Button>
  );
}
