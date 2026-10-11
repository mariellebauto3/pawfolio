"use client";

import { DialogFrame, type DialogProps } from "./dialog-frame";

// Panel that slides in from the right (460 px; full screen on phones), e.g. filters on Browse.
// Same anatomy and keyboard behaviour as Modal.
export function Drawer(props: DialogProps) {
  return <DialogFrame placement="side" {...props} />;
}
