"use client";

import { useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { FileUpload } from "@/components/forms/file-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/utils/format-date";
import { formatFileSize } from "@/lib/utils/format-file-size";
import type { VetRecordSlot, useVetRecordDraft } from "../hooks/use-vet-record-draft";
import { RESUME_LIMITS } from "../schemas/resume-schemas";

type Props = {
  /** The step's unsaved record changes. The wizard holds them and sends them on Next or Save. */
  draft: ReturnType<typeof useVetRecordDraft>;
  /** Takes a record off the step; the wizard asks first when the record is on file. */
  onRemove: (slot: VetRecordSlot) => void;
};

const FORMATS: Record<string, string> = { "image/jpeg": "JPG", "image/png": "PNG", "application/pdf": "PDF" };

// The vet record files of PR-07. They are private: a human sees them only after one of the pet's requests is
// approved, and here the owner sees what was sent, not the file (SEC-PRIV-01). Adding and removing one is a draft
// until the pet presses Next or Save, like the typed fields above it (BUG-03).
export function ResumeVetRecords({ draft, onRemove }: Props) {
  const { slots, changed, saving } = draft;
  // A new key empties the picker once its file has joined the list below.
  const [uploadKey, setUploadKey] = useState(0);
  const full = slots.length >= RESUME_LIMITS.maxVetRecords;

  function choose(files: File[]) {
    const file = files[0];
    if (!file) return;
    draft.add(file);
    setUploadKey((key) => key + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      {changed && (
        <Alert
          action={
            <Button variant="tertiary" size="sm" disabled={saving} onClick={draft.discard}>
              Discard record changes
            </Button>
          }
        >
          Your vet record changes aren&apos;t saved yet. Press Next or Save to keep them; leaving this page drops them.
        </Alert>
      )}

      {slots.length > 0 && (
        <ul aria-label="Vet records" className="flex flex-col gap-2">
          {slots.map((slot, index) => {
            const type = slot.record?.mime_type ?? slot.file?.type ?? "";
            const size = slot.record?.size_bytes ?? slot.file?.size ?? 0;
            return (
              <li key={slot.key} className="flex items-center gap-3 rounded-control border border-line px-3 py-2">
                <Icon name="file" className="size-5 shrink-0 text-ink-muted" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2 font-bold">
                    Vet record {index + 1}
                    {slot.file && <Badge tone="progress">Not saved yet</Badge>}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {[FORMATS[type], formatFileSize(size)].filter(Boolean).join(", ")}
                    {slot.record && <> · Added {formatDate(slot.record.uploaded_at)}</>}
                  </span>
                </span>
                <Button variant="tertiary" size="sm" disabled={saving} onClick={() => onRemove(slot)}>
                  Remove<span className="sr-only"> vet record {index + 1}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {full ? (
        <p className="text-sm text-ink-muted">You&apos;ve added {RESUME_LIMITS.maxVetRecords} vet records, the most a resume holds.</p>
      ) : (
        <FileUpload
          key={uploadKey}
          label="Vet records"
          optional
          hint="Vaccination card, vet report or certificate. JPG, PNG or PDF, up to 5 MB. Visible to humans only after a request is approved."
          onFilesChange={choose}
        />
      )}
    </div>
  );
}
