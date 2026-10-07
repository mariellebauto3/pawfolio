"use client";

import type { ReactNode } from "react";
import { Drawer } from "@/components/overlays/drawer";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  /** Closed without applying: the caller puts the filters back as the results show them. */
  onClose: () => void;
  /** "Show results": the caller closes the drawer and applies what is picked. */
  onApply: () => void;
  onClear: () => void;
  /** Nothing is picked, so there is nothing to clear. */
  empty: boolean;
  /** The filter controls. */
  children: ReactNode;
};

// The Browse filters on phones and tablets (DS-01, DS-02), where there is no room for the side panel.
export function FilterDrawer({ open, onClose, onApply, onClear, empty, children }: Props) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filters"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
      footer={
        <>
          <Button onClick={onClear} disabled={empty}>
            Clear all
          </Button>
          <Button type="submit" variant="primary">
            Show results
          </Button>
        </>
      }
    >
      {children}
    </Drawer>
  );
}
