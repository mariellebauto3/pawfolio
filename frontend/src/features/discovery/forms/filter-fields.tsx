"use client";

import { ChoiceChips } from "@/components/forms/choice-chips";
import { Field } from "@/components/forms/field";
import { Select } from "@/components/forms/select";
import { PROVINCES } from "@/constants/provinces";
import { BROWSE_PARAMS, type BrowseFilters, type BrowseKind, filterFieldsFor } from "../schemas/browse-filters";

type Props = {
  kind: BrowseKind;
  /** What is picked right now, whether or not it has been applied yet. */
  value: BrowseFilters;
  onChange: (next: BrowseFilters) => void;
};

const ANYWHERE = { value: "", label: "All provinces" };
const ANY = { value: "", label: "Any" };

// The filter controls of Browse (DS-01, DS-02), shared by the side panel and the drawer on phones. Nothing here
// loads results: the form around it applies the filters when "Show results" is pressed.
export function FilterFields({ kind, value, onChange }: Props) {
  const pick = (name: string, values: string[]) => onChange({ ...value, picked: { ...value.picked, [name]: values } });

  return (
    <>
      <Field label="Location">
        <Select
          name={BROWSE_PARAMS.province}
          value={value.province}
          onChange={(event) => onChange({ ...value, province: event.target.value })}
          options={[ANYWHERE, ...PROVINCES]}
        />
      </Field>

      {filterFieldsFor(kind).map((field) =>
        field.single ? (
          <ChoiceChips
            key={field.name}
            name={field.name}
            legend={field.legend}
            options={[ANY, ...field.options]}
            value={value.picked[field.name]?.[0] ?? ""}
            onChange={(picked) => pick(field.name, picked ? [picked] : [])}
          />
        ) : (
          <ChoiceChips
            key={field.name}
            multiple
            name={field.name}
            legend={field.legend}
            options={field.options}
            value={value.picked[field.name] ?? []}
            onChange={(picked) => pick(field.name, picked)}
          />
        ),
      )}
    </>
  );
}
