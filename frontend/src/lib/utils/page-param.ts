/**
 * The page number of a list, read from the page's URL (`?page=2`). Anything that isn't a whole number of 1 or more
 * is page 1, so a hand-edited address never reaches the API as it was typed.
 */
export function pageFromUrl(value: string | string[] | undefined): number {
  const text = Array.isArray(value) ? value[0] : value;
  return text !== undefined && /^\d{1,6}$/.test(text) ? Math.max(Number(text), 1) : 1;
}
