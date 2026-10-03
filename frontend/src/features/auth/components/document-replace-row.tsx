import type { ReactNode } from "react";
import type { SubmittedDocument } from "@/types/account-status";
import { CurrentDocuments } from "./current-documents";

type Props = {
  /** "Current ID", "Current photos". */
  currentLabel: string;
  current: SubmittedDocument[];
  /** The FileUpload that replaces them. */
  children: ReactNode;
};

// One kind of document on AU-19: what is on file beside the upload that replaces it (stacked on phones).
export function DocumentReplaceRow({ currentLabel, current, children }: Props) {
  return (
    <div className="grid items-start gap-4 md:grid-cols-[15rem_1fr]">
      <CurrentDocuments label={currentLabel} documents={current} />
      {children}
    </div>
  );
}
