"use client";

import { Field } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { ID_TYPE_LABELS } from "@/constants/verification";
import type { FieldErrors } from "@/lib/api/errors";
import { ID_TYPES } from "@/types/verification";
import type { TextBinder } from "../hooks/use-form-fields";

const ID_TYPE_OPTIONS = ID_TYPES.map((value) => ({ value, label: ID_TYPE_LABELS[value] }));

type Props = {
  text: TextBinder<"id_type">;
  errors: FieldErrors;
};

// Which valid ID a human sends (AU-16), also edited on AU-19.
export function IdTypeField({ text, errors }: Props) {
  return (
    <Field label="ID type" error={errors.id_type}>
      <Select {...text("id_type")} options={ID_TYPE_OPTIONS} placeholder="Choose the type of ID" />
    </Field>
  );
}
