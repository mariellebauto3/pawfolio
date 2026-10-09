"use client";

import { type ReactNode, createContext, useContext } from "react";
import type { ReportTarget } from "@/types/report";

export type ReportLauncher = {
  /** Opens the report dialog (RP-01) for one post, comment, profile or account. */
  report: (target: ReportTarget) => void;
};

const ReportContext = createContext<ReportLauncher | null>(null);

// How a screen offers Report without knowing the Reports module: the feed's menus and a profile's actions call
// `useReport()`. This file is only the contract; the reports feature fills it (`ReportHost`, mounted by the member
// layout), so one feature never imports another (frontend-guidelines §2).
export function ReportProvider({ value, children }: { value: ReportLauncher | null; children: ReactNode }) {
  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

/** Null where nothing feeds it (a page outside the member layout): leave Report out there. */
export function useReport(): ReportLauncher | null {
  return useContext(ReportContext);
}
