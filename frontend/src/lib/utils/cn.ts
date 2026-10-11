// Joins class names, skipping falsy values. It doesn't resolve conflicting Tailwind utilities, so a `className` passed
// to a shared component is for layout (margin, width, grid placement), not for restyling the component.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
