"use client";

import { type ReactNode, useEffect, useRef } from "react";

type Props = {
  /**
   * What the panel stands for as the page was last rendered: the request's status, and the step of its Meet &
   * Greet when it has one (a booked slot is still Approved).
   */
  state: string;
  children: ReactNode;
};

// The frame around a request's action panel. When what it stands for changes while the page is open, the reader
// has just acted on the request and the buttons they pressed are gone with the old panel; focus moves here, so a
// keyboard stays where the action was and a screen reader reads where the request stands now.
export function RequestPanelFrame({ state, children }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const shown = useRef(state);

  useEffect(() => {
    if (shown.current === state) return;
    shown.current = state;
    frame.current?.focus();
  }, [state]);

  return (
    <div ref={frame} tabIndex={-1} className="rounded-card">
      {children}
    </div>
  );
}
