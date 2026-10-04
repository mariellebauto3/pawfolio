"use client";

import { Alert } from "@/components/feedback/alert";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import type { DocumentFile } from "../hooks/use-document-file";

type Props = {
  open: boolean;
  onClose: () => void;
  /** What the document is: "Valid ID (UMID)". */
  title: string;
  /** Format, size and date: "JPG, 1.8 MB, sent Sep 29, 2026". */
  subtitle: string;
  /** Describes the picture for screen readers: "Valid ID (UMID) submitted for Kulit". */
  alt: string;
  file: DocumentFile;
};

// "Open full size" on a submitted document (AU-23, AU-24). The file comes from the admin endpoint as a JPG, PNG or
// PDF and nothing else (SEC-FE-09), and is shown from memory. "Open in a new tab" hands the same in-memory file to
// the browser's own viewer, for zooming into an ID or paging through a PDF.
export function DocumentViewer({ open, onClose, title, subtitle, alt, file }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          {file.status === "ready" && (
            <a href={file.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: "primary" })}>
              Open in a new tab
            </a>
          )}
        </>
      }
    >
      {(file.status === "loading" || file.status === "idle") && (
        <SkeletonGroup label={`Loading ${title}`}>
          <Skeleton shape="block" className="aspect-4/3 w-full" />
        </SkeletonGroup>
      )}

      {file.status === "error" && (
        <Alert
          tone="error"
          announce
          title="This document didn't load"
          action={
            <Button size="sm" onClick={file.retry}>
              Try again
            </Button>
          }
        >
          {file.message}
        </Alert>
      )}

      {file.status === "ready" &&
        (file.type === "application/pdf" ? (
          <>
            <iframe src={file.url} title={alt} className="h-[60dvh] w-full rounded-control border border-line bg-surface-sunken" />
            <p className="text-sm text-ink-muted">If the PDF doesn&apos;t show here, open it in a new tab.</p>
          </>
        ) : (
          // A blob: address from memory: there is nothing for the image optimizer to fetch.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={alt} className="mx-auto h-auto max-w-full rounded-control border border-line" />
        ))}
    </Modal>
  );
}
