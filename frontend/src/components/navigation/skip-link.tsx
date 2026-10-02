export const MAIN_CONTENT_ID = "main-content";

// First focusable element of every shell: keyboard users jump past the navigation (WCAG 2.4.1). Hidden until focused.
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className={
        "sr-only rounded-pill bg-primary px-5 py-2.5 font-bold text-primary-ink no-underline " +
        "focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--pf-z-toast)"
      }
    >
      Skip to main content
    </a>
  );
}
