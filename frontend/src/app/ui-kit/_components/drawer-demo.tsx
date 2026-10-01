"use client";

import { useState } from "react";
import { ChoiceChips } from "@/components/forms/choice-chips";
import { Toggle } from "@/components/forms/toggle";
import { Drawer } from "@/components/overlays/drawer";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Dev-only demo for /ui-kit: a Browse filters drawer (DS-02) with fake options.
export function DrawerDemo() {
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState(0);

  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<Icon name="filter" className="size-4" />}>
        Filters
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Filter pets"
        subtitle="Only pets in your province are shown."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRun((r) => r + 1)}>
              Clear all
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Show 24 pets
            </Button>
          </>
        }
      >
        <div key={run} className="flex flex-col gap-6">
          <ChoiceChips legend="Species" multiple options={["Dog", "Cat", "Other"]} defaultValue={["Dog"]} />
          <ChoiceChips legend="Size" multiple options={["Small", "Medium", "Large"]} />
          <ChoiceChips legend="Energy level" options={["Relaxed", "Moderate", "Active"]} />
          <Toggle label="Good with kids" labelPosition="start" />
          <Toggle label="Good with other pets" labelPosition="start" />
        </div>
      </Drawer>
    </>
  );
}
