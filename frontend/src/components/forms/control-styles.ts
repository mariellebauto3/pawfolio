// Shared look for text-like controls (Input, Textarea, Select). 44 px tall, 16 px text so phones don't zoom on focus,
// a 3:1 border, and a red border plus ring when invalid (the inline error message carries the meaning).
export const CONTROL_CLASSES =
  "w-full min-h-11 rounded-control border border-line-strong bg-surface px-3 py-2 text-base text-ink " +
  "placeholder:text-ink-muted transition-colors duration-200 ease-out hover:border-ink-muted " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger " +
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunken disabled:text-ink-muted";

// Read-only applies to Input and Textarea only: <select> always matches :read-only.
export const READ_ONLY_CLASSES = "read-only:border-line read-only:bg-surface-sunken read-only:hover:border-line";
