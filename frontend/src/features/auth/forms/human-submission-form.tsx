"use client";

import { useState } from "react";
import { FileUpload } from "@/components/forms/file-upload";
import { Card } from "@/components/ui/card";
import type { HumanSubmission } from "@/types/account-status";
import { DocumentReplaceRow } from "../components/document-replace-row";
import { HumanAddressFields } from "../components/human-address-fields";
import { HumanPersonalFields } from "../components/human-personal-fields";
import { IdTypeField } from "../components/id-type-field";
import { SubmissionFormFrame } from "../components/submission-form-frame";
import { useSubmissionForm } from "../hooks/use-submission-form";
import {
  HUMAN_SUBMISSION_FIELDS,
  humanSubmissionValues,
  toHumanSubmissionForm,
  validateHumanSubmission,
} from "../schemas/submission-schemas";

type Props = {
  submission: HumanSubmission;
};

// AU-19 for a human account: the sign-up details again, filled in, with the ID replaceable. Saving sends them back
// to the review queue (FR2).
export function HumanSubmissionForm({ submission }: Props) {
  const [initial] = useState(() => humanSubmissionValues(submission));
  const { errors, problem, set, text, formProps } = useSubmissionForm({
    initial,
    fields: HUMAN_SUBMISSION_FIELDS,
    validate: validateHumanSubmission,
    toForm: toHumanSubmissionForm,
  });
  const validId = submission.documents.filter((document) => document.document_type === "valid_id");

  return (
    <SubmissionFormFrame {...formProps} problem={problem}>
      <Card title="Personal details">
        <HumanPersonalFields text={text} errors={errors} />
      </Card>

      <Card title="Address">
        <HumanAddressFields text={text} errors={errors} />
      </Card>

      <Card title="Valid ID" description="Leave the upload empty to keep the ID you already sent. It is visible to admins only.">
        <IdTypeField text={text} errors={errors} />
        <DocumentReplaceRow currentLabel="Current ID" current={validId}>
          <FileUpload
            label="Replace the ID photo"
            optional
            hint="JPG, PNG or PDF, up to 5 MB."
            error={errors.valid_id}
            onFilesChange={(files) => set("valid_id", files[0] ?? null)}
          />
        </DocumentReplaceRow>
      </Card>
    </SubmissionFormFrame>
  );
}
