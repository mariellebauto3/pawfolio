"use client";

import { type ReactNode, useEffect, useRef } from "react";
import type { RequestStatus } from "@/types/statuses";

type Props = {
  /** The request's status as the page was last rendered. */
  status: RequestStatus;
  children: ReactNode;
};

// The frame around a request's action panel. When the status changes while the page is open, the reader has just
// answered the request and the buttons they pressed are gone with the old panel; focus moves here, so a keyboard
// stays where the action was and a screen reader reads where the request stands now.
export function RequestPanelFrame({ status, children }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const shown = useRef(status);

  useEffect(() => {
    if (shown.current === status) return;
    shown.current = status;
    frame.current?.focus();
  }, [status]);

  return (
    <div ref={frame} tabIndex={-1} className="rounded-card">
      {children}
    </div>
  );
}
