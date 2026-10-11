"use client";

import { useState } from "react";
import type { OwnHomeProfile } from "../types/own-home-profile";
import { OpenToAdoptToggle } from "./open-to-adopt-toggle";

type Props = {
  /** The human's own Home Profile, as the page loaded it. */
  home: OwnHomeProfile;
  /** Said under the switch while it is off, e.g. what turning it on does on this page. */
  offHint?: string;
  className?: string;
};

// The Open to Adopt switch for a page that shows nothing else of the Home Profile, such as Pets for You (MT-01):
// it keeps the profile the API last answered with, so the switch always shows what was saved.
export function OpenToAdoptSwitch({ home: loaded, offHint, className }: Props) {
  const [home, setHome] = useState(loaded);

  return <OpenToAdoptToggle home={home} onChange={setHome} description={home.is_open_to_adopt ? undefined : offHint} className={className} />;
}
