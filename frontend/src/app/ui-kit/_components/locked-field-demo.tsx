"use client";

import { useState } from "react";
import { LockedField } from "@/components/forms/locked-field";

// Dev-only demo for /ui-kit. In the app, "Request a change" opens the AC-03 dialog from the accounts feature.
export function LockedFieldDemo() {
  const [asked, setAsked] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <LockedField label="Name" value="Mochi" onRequestChange={() => setAsked("Name")} />
      <LockedField label="Breed" value="Aspin" onRequestChange={() => setAsked("Breed")} />
      <p aria-live="polite" className="text-sm text-ink-muted">
        {asked && `This would open "Request a change to verified details" for ${asked}.`}
      </p>
    </div>
  );
}
