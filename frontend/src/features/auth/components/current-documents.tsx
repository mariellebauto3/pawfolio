import { Icon } from "@/components/ui/icon";
import { DOCUMENT_FORMAT_LABELS } from "@/constants/verification";
import { summarizeDocuments } from "@/lib/auth/account-status";
import { formatDate } from "@/lib/utils/format-date";
import type { SubmittedDocument } from "@/types/account-status";

type Props = {
  /** "Current ID", "Current photos". */
  label: string;
  /** The files of one kind sent with the last submission; empty when none was sent. */
  documents: SubmittedDocument[];
};

// What is on file for one kind of document (AU-19), next to the upload that replaces it. The LoFi shows the ID
// photo here; verification documents are served to admins only (SEC-PRIV-01, NFR4), so the owner sees what was sent
// and when, not the file.
export function CurrentDocuments({ label, documents }: Props) {
  const [first] = documents;
  const formats = [...new Set(documents.map((document) => DOCUMENT_FORMAT_LABELS[document.mime_type]).filter(Boolean))].join(", ");

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-bold text-ink">{label}</p>
      <div className="flex min-h-24 items-center gap-3 rounded-card border border-line bg-surface-sunken p-3">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-control bg-surface text-ink-muted">
          <Icon name="file" className="size-5" />
        </span>
        {first ? (
          <p className="flex min-w-0 flex-col">
            <span className="text-sm font-bold break-words text-ink">{summarizeDocuments(documents).join(", ")}</span>
            <span className="text-xs text-ink-muted">
              {[formats, `sent ${formatDate(first.uploaded_at)}`].filter(Boolean).join(", ")}
            </span>
          </p>
        ) : (
          <p className="text-sm text-ink-muted">Not added yet</p>
        )}
      </div>
    </div>
  );
}
