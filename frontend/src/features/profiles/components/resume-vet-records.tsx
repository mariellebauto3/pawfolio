"use client";

import { useState } from "react";
import { FileUpload } from "@/components/forms/file-upload";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/utils/format-date";
import { formatFileSize } from "@/lib/utils/format-file-size";
import { useToast } from "@/providers/toast-provider";
import { addVetRecord } from "../api/resume";
import { RESUME_LIMITS } from "../schemas/resume-schemas";
import type { OwnPet, VetRecord } from "../types/own-pet";

type Props = {
  pet: OwnPet;
  onChange: (pet: OwnPet) => void;
  /** Asks before removing a record. The wizard renders the confirmation, outside its own form. */
  onRemove: (record: VetRecord) => void;
};

const FORMATS: Record<string, string> = { "image/jpeg": "JPG", "image/png": "PNG", "application/pdf": "PDF" };
const UNKNOWN_PROBLEM = "We couldn't add the record. Check your connection and try again.";

// The vet record files of PR-07. They are private: a human sees them only after one of the pet's requests is
// approved, and here the owner sees what was sent, not the file (SEC-PRIV-01). Adding and removing save right away.
export function ResumeVetRecords({ pet, onChange, onRemove }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [uploadKey, setUploadKey] = useState(0);

  const records = pet.vet_records;
  const full = records.length >= RESUME_LIMITS.maxVetRecords;

  async function upload(files: File[]) {
    const file = files[0];
    if (!file || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      onChange(await addVetRecord(api, file));
      setUploadKey((key) => key + 1);
      toast.show("Vet record added.");
    } catch (failure) {
      setError(isApiError(failure) ? (failure.fieldErrors.vet_record ?? failure.message) : UNKNOWN_PROBLEM);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {records.length > 0 && (
        <ul aria-label="Vet records on file" className="flex flex-col gap-2">
          {records.map((record, index) => (
            <li key={record.id} className="flex items-center gap-3 rounded-control border border-line px-3 py-2">
              <Icon name="file" className="size-5 shrink-0 text-ink-muted" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">Vet record {index + 1}</span>
                <span className="text-sm text-ink-muted">
                  {[FORMATS[record.mime_type], formatFileSize(record.size_bytes)].filter(Boolean).join(", ")} · Added{" "}
                  {formatDate(record.uploaded_at)}
                </span>
              </span>
              <Button variant="tertiary" size="sm" disabled={busy} onClick={() => onRemove(record)}>
                Remove<span className="sr-only"> vet record {index + 1}</span>
              </Button>
            </li>
          ))}
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
          error={error}
          onFilesChange={upload}
        />
      )}

    </div>
  );
}
