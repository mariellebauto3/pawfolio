"use client";

import { type ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FurparentDialog } from "../dialogs/furparent-dialog";
import type { AdoptionPair } from "../types/adoptions";

type Moment = {
  /** The adoption just went through: show "You're a Furparent" (AL-02). */
  celebrate: () => void;
};

const MomentContext = createContext<Moment | null>(null);

/** The moment an adoption is celebrated, for the button that makes one. Null outside a request's page. */
export function useAdoptionMoment(): Moment | null {
  return useContext(MomentContext);
}

type Props = AdoptionPair & {
  /** The request's action panel, which holds Adopt until the request is Adopted. */
  children: ReactNode;
};

// Holds "You're a Furparent" (AL-02) around a request's action panel. Adopting changes that panel: the page is read
// again and the Adopt button is gone, so a dialog owned by the button would go with it. This stays where it is
// through that reload, so the celebration opens over a page that already shows the request as Adopted. When it
// closes, the button that opened it no longer exists, so focus goes to the panel, where the request stands now.
export function AdoptionMoment({ pet, home, children }: Props) {
  const [celebrating, setCelebrating] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const celebrated = useRef(false);
  const moment = useMemo(() => ({ celebrate: () => setCelebrating(true) }), []);

  useEffect(() => {
    if (celebrating) {
      celebrated.current = true;
    } else if (celebrated.current) {
      celebrated.current = false;
      frame.current?.focus();
    }
  }, [celebrating]);

  return (
    <MomentContext.Provider value={moment}>
      <div ref={frame} tabIndex={-1} className="rounded-card">
        {children}
      </div>
      <FurparentDialog open={celebrating} onClose={() => setCelebrating(false)} pet={pet} home={home} />
    </MomentContext.Provider>
  );
}
