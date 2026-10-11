/**
 * Hands a file the page already holds in memory to the browser as a download. The `download` attribute makes the
 * browser save it instead of opening it, so it is never shown as a page of this site, and the `blob:` address is
 * dropped as soon as the save has started (SEC-FE-09). Browser only.
 */
export function saveFile(file: Blob, name: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // After the click has been handled: revoking in the same tick can cancel the save in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
