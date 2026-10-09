"use client";

import type { ReactNode } from "react";
import { AlertsProvider } from "@/providers/alerts-provider";
import { useAlertsFeed } from "../hooks/use-alerts-feed";

// Feeds the shell's Alerts tab (NT-01) and the Notifications page with the account's notifications. Mounted once,
// around the member shell, so the count carries on from page to page.
export function AlertsFeed({ children }: { children: ReactNode }) {
  return <AlertsProvider value={useAlertsFeed()}>{children}</AlertsProvider>;
}
