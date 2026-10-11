"use client";

import { DialogFrame, type DialogProps } from "./dialog-frame";

type Props = DialogProps & {
  /** `md` 520 px for confirmations and short forms; `lg` 640 px for more content (match breakdown, create post). */
  size?: "md" | "lg";
  /** `alertdialog` for confirmations that interrupt (ConfirmDialog sets it). */
  role?: "dialog" | "alertdialog";
};

// Dialog for confirmations, short forms and explanations (ui-guidelines §5). Everything else is a page.
// Title, optional subtitle, close button, body, footer. Focus is trapped, Escape closes, focus returns to the trigger.
// On phones it opens as a full-width bottom sheet.
//
// const [open, setOpen] = useState(false);
// <Modal open={open} onClose={() => setOpen(false)} title="Report this post" footer={…}>…</Modal>
export function Modal({ size = "md", ...props }: Props) {
  return <DialogFrame placement="center" size={size} {...props} />;
}
