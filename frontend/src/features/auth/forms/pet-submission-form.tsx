"use client";

import { useState } from "react";
import { FileUpload } from "@/components/forms/file-upload";
import { Card } from "@/components/ui/card";
import { MAX_SIGN_UP_PET_PHOTOS } from "@/lib/auth/sign-up-rules";
import type { PetSubmission } from "@/types/account-status";
import type { VerificationDocumentType } from "@/types/verification";
import { CaretakerFields } from "../components/caretaker-fields";
import { DocumentReplaceRow } from "../components/document-replace-row";
import { PetDetailFields } from "../components/pet-detail-fields";
import { SubmissionFormFrame } from "../components/submission-form-frame";
import { useSubmissionForm } from "../hooks/use-submission-form";
import { PET_SUBMISSION_FIELDS, petSubmissionValues, toPetSubmissionForm, validatePetSubmission } from "../schemas/submission-schemas";

type Props = {
  submission: PetSubmission;
};

// AU-19 for a pet account: the sign-up details again, filled in, with each document replaceable. Saving sends them
// back to the review queue (FR19).
export function PetSubmissionForm({ submission }: Props) {
  const [initial] = useState(() => petSubmissionValues(submission));
  const { errors, problem, set, text, formProps } = useSubmissionForm({
    initial,
    fields: PET_SUBMISSION_FIELDS,
    validate: validatePetSubmission,
    toForm: toPetSubmissionForm,
  });
  const sent = (type: VerificationDocumentType) => submission.documents.filter((document) => document.document_type === type);
  const vetRecord = sent("vet_record_or_certificate");

  return (
    <SubmissionFormFrame {...formProps} problem={problem}>
      <Card title="Pet details">
        <PetDetailFields
          text={text}
          onAgeAmountChange={(digits) => set("age_amount", digits, "approximate_age_months")}
          errors={errors}
        />
      </Card>

      <Card title="Caretaker" description="The person our admins verify: a foster, finder or shelter volunteer looking after the pet.">
        <CaretakerFields text={text} errors={errors} />
      </Card>

      <Card title="Photos and documents" description="Leave an upload empty to keep what you already sent. Documents are visible to admins only.">
        <DocumentReplaceRow currentLabel="Current ID" current={sent("valid_id")}>
          <FileUpload
            label="Replace the caretaker's valid ID"
            optional
            hint="JPG, PNG or PDF, up to 5 MB."
            error={errors.valid_id}
            onFilesChange={(files) => set("valid_id", files[0] ?? null)}
          />
        </DocumentReplaceRow>
        <DocumentReplaceRow currentLabel="Current photos" current={sent("pet_photo")}>
          <FileUpload
            label="Replace the pet's photos"
            optional
            accept={["jpg", "png"]}
            multiple
            maxFiles={MAX_SIGN_UP_PET_PHOTOS}
            hint={`New photos replace all the current ones. JPG or PNG, up to 5 MB each, up to ${MAX_SIGN_UP_PET_PHOTOS} photos.`}
            error={errors.photos}
            onFilesChange={(files) => set("photos", files)}
          />
        </DocumentReplaceRow>
        <DocumentReplaceRow currentLabel="Current vet record" current={vetRecord}>
          <FileUpload
            label={vetRecord.length ? "Replace the vet record or shelter certificate" : "Add a vet record or shelter certificate"}
            optional
            hint="Speeds up the review. JPG, PNG or PDF, up to 5 MB."
            error={errors.vet_record}
            onFilesChange={(files) => set("vet_record", files[0] ?? null)}
          />
        </DocumentReplaceRow>
      </Card>
    </SubmissionFormFrame>
  );
}
