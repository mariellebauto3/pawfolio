/** "1.8 MB", "420 KB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  const kb = bytes / 1024;
  return kb < 1000 ? `${Math.max(Math.round(kb), 1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}
