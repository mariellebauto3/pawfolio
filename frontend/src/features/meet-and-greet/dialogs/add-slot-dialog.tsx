"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { ChoiceChips } from "@/components/forms/choice-chips";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api/client";
import { philippineToday } from "@/lib/utils/format-date";
import type { MeetGreetSlot, PlaceType } from "@/types/meet-and-greet";
import { addSlots } from "../api/slots";
import { useMeetChange } from "../hooks/use-meet-change";
import { PLACE_DETAILS_MAX, PLACE_TYPES, PLACE_TYPE_LABELS, REPEAT_WEEKS, type SlotDraft, type SlotErrors, readSlotDraft } from "../schemas/slots";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The slots are added. The dialog has closed; the caller confirms with a toast and shows them. */
  onAdded: (slots: MeetGreetSlot[]) => void;
};

const UNKNOWN_PROBLEM = "We couldn't add the slot. Check your connection and try again.";
const PLACES = PLACE_TYPES.map((value) => ({ value, label: PLACE_TYPE_LABELS[value] }));
const ONCE = "once";
const WEEKLY = "weekly";
const REPEATS = [
  { value: ONCE, label: "Does not repeat" },
  { value: WEEKLY, label: `Weekly for ${REPEAT_WEEKS} weeks` },
];

// MG-02 Add a Meet & Greet slot: a day, a time and a place a pet with an approved request can book (FR11). The time
// is typed and shown in Philippine time. Only the slot is sent; whose it is comes from the session, and the API
// checks it again (SEC-INPUT-05, SEC-FE-05).
export function AddSlotDialog(props: Props) {
  // Mounted only while open, so every visit starts with an empty form.
  return props.open ? <AddSlotDialogContent {...props} /> : null;
}

function AddSlotDialogContent({ onClose, onAdded }: Props) {
  const [draft, setDraft] = useState<SlotDraft>({ date: "", time: "", placeType: "public_spot", placeDetails: "", repeats: false });
  const [errors, setErrors] = useState<SlotErrors>({});
  const { busy, problem, setProblem, run } = useMeetChange(UNKNOWN_PROBLEM);
  const atCaretaker = draft.placeType === "caretaker_location";

  function change(part: Partial<SlotDraft>) {
    setDraft((current) => ({ ...current, ...part }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readSlotDraft(draft);
    setErrors("errors" in read ? read.errors : {});
    if ("errors" in read) return;

    let added: MeetGreetSlot[] = [];
    const done = await run(
      async () => {
        added = await addSlots(api, read.slot);
      },
      (fields, message) => {
        // The API names the whole moment `starts_at`; the time field is where it is fixed.
        const found: SlotErrors = { time: fields.starts_at, place_details: fields.place_details };
        setErrors(found);
        if (!found.time && !found.place_details) setProblem(fields.place_type ?? fields.repeat_weeks ?? message);
      },
    );
    if (!done) return;
    onClose();
    onAdded(added);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a Meet & Greet slot"
      subtitle="A pet you approved can book it. You confirm each booking."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingLabel="Adding the slot">
            Add slot
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" error={errors.date} required>
          <Input type="date" name="date" value={draft.date} min={philippineToday()} onChange={(event) => change({ date: event.target.value })} readOnly={busy} />
        </Field>
        <Field label="Time" error={errors.time} hint="Philippine time" required>
          <Input type="time" name="time" value={draft.time} step={300} onChange={(event) => change({ time: event.target.value })} readOnly={busy} />
        </Field>
      </div>

      <ChoiceChips
        legend="Meeting place"
        name="place_type"
        options={PLACES}
        value={draft.placeType}
        onChange={(value) => change({ placeType: value as PlaceType })}
        disabled={busy}
        required
      />

      <Field
        label="Place details"
        optional={atCaretaker}
        required={!atCaretaker}
        error={errors.place_details}
        hint={atCaretaker ? "You’ll agree on the exact place with the caretaker once the meeting is confirmed." : "The name of the place, and where to find each other."}
      >
        <Input
          name="place_details"
          value={draft.placeDetails}
          onChange={(event) => change({ placeDetails: event.target.value })}
          maxLength={PLACE_DETAILS_MAX}
          placeholder={atCaretaker ? undefined : "e.g. UP Diliman Academic Oval, near the sunken garden"}
          readOnly={busy}
        />
      </Field>

      <ChoiceChips
        legend="Repeat"
        name="repeat"
        options={REPEATS}
        value={draft.repeats ? WEEKLY : ONCE}
        onChange={(value) => change({ repeats: value === WEEKLY })}
        disabled={busy}
      />

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <Icon name="info" className="mt-0.5 size-4 shrink-0" />
        Public places are safest for a first meeting.
      </p>

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
