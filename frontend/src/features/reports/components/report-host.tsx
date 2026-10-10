"use client";

import { type ReactNode, useMemo, useState } from "react";
import { ReportProvider } from "@/providers/report-provider";
import { useToast } from "@/providers/toast-provider";
import type { ReportTarget } from "@/types/report";
import { ReportDialog } from "../dialogs/report-dialog";

// Gives every member page a way to report (RP-01): the feed's menus and a profile's actions call `useReport()`, and
// the one dialog opens here. Mounted once, around the member shell. The toast is RP-02; it shows after the dialog
// has closed, since a dialog covers toasts.
export function ReportHost({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const launcher = useMemo(() => ({ report: setTarget }), []);

  return (
    <ReportProvider value={launcher}>
      {children}
      <ReportDialog
        target={target}
        onClose={() => setTarget(null)}
        onSent={() => toast.show("Report sent. An admin will review it.")}
        onSettled={(outcome, message) => toast.show(message, { tone: outcome === "gone" ? "error" : "info" })}
      />
    </ReportProvider>
  );
}
