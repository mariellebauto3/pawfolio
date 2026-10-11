"use client";

import { useCallback, useState } from "react";
import { Skeleton } from "@/components/feedback/skeleton";
import { DocumentViewer } from "@/components/overlays/document-viewer";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { DOCUMENT_FORMAT_LABELS } from "@/constants/verification";
import { type DocumentFile, useDocumentFile } from "@/hooks/use-document-file";
import { api } from "@/lib/api/client";
import { documentLabels, formatFileSize } from "@/lib/auth/verification-review";
import { formatDate } from "@/lib/utils/format-date";
import type { ReviewDocument } from "@/types/verification-review";
import { getVerificationDocument } from "../api/verification-review";

type Props = {
  accountId: number;
  /** The pet's or the human's name, to describe each picture. */
  ownerName: string;
  documents: ReviewDocument[];
};

// The files sent for verification (AU-23, AU-24): the valid ID, and for a pet its photos and vet record. Admins
// only (NFR4, SEC-PRIV-01). Pictures load into the tiles through the admin endpoint; a PDF is fetched when opened.
export function ReviewDocuments({ accountId, ownerName, documents }: Props) {
  const labels = documentLabels(documents);

  return (
    <Card title="Documents" description="Visible to admins only.">
      {documents.length === 0 ? (
        <p className="text-ink-muted">No documents came with this submission.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {documents.map((document, index) => (
            <DocumentTile key={document.id} accountId={accountId} ownerName={ownerName} document={document} label={labels[index]} />
          ))}
        </ul>
      )}
    </Card>
  );
}

type TileProps = {
  accountId: number;
  ownerName: string;
  document: ReviewDocument;
  label: string;
};

function DocumentTile({ accountId, ownerName, document, label }: TileProps) {
  const [open, setOpen] = useState(false);
  const isPdf = document.mime_type === "application/pdf";
  const load = useCallback((signal: AbortSignal) => getVerificationDocument(api, accountId, document.id, signal), [accountId, document.id]);
  const file = useDocumentFile(load, `${accountId}/${document.id}`, !isPdf || open);
  const format = DOCUMENT_FORMAT_LABELS[document.mime_type];
  const meta = [format, formatFileSize(document.size_bytes)].filter(Boolean).join(", ");

  return (
    <li>
      {/* One button for the whole tile: its name is the label, the details and "Open full size". */}
      <button type="button" onClick={() => setOpen(true)} className="group flex w-full cursor-pointer flex-col gap-2 rounded-card text-left">
        <span
          className={
            "relative grid aspect-4/3 w-full place-items-center overflow-hidden rounded-card border border-line bg-surface-sunken " +
            "transition-colors duration-200 ease-out group-hover:border-primary"
          }
        >
          <Thumbnail file={file} isPdf={isPdf} />
        </span>
        <span className="flex flex-col">
          <span className="font-bold">{label}</span>
          {meta && <span className="text-sm text-ink-muted">{meta}</span>}
          <span className="text-sm font-bold text-primary underline-offset-4 group-hover:underline">Open full size</span>
        </span>
      </button>
      <DocumentViewer
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        subtitle={[meta, `sent ${formatDate(document.uploaded_at)}`].filter(Boolean).join(", ")}
        alt={`${label} submitted for ${ownerName}`}
        file={file}
      />
    </li>
  );
}

function Thumbnail({ file, isPdf }: { file: DocumentFile; isPdf: boolean }) {
  if (isPdf) return <Placeholder icon="file" text="PDF" />;
  if (file.status === "error") return <Placeholder icon="triangle-alert" text="Didn't load" />;
  if (file.status !== "ready") return <Skeleton shape="block" className="absolute inset-0 rounded-none" />;
  // The tile's text names the picture, so it isn't read twice. A blob: address has nothing for next/image to fetch.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={file.url} alt="" className="absolute inset-0 size-full object-contain" />;
}

function Placeholder({ icon, text }: { icon: "file" | "triangle-alert"; text: string }) {
  return (
    <span className="flex flex-col items-center gap-1 text-sm text-ink-muted">
      <Icon name={icon} className="size-8 text-ink-subtle" />
      {text}
    </span>
  );
}
