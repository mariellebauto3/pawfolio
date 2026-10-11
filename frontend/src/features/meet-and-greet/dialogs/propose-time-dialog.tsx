"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { formatMeetingTime } from "@/lib/utils/format-date";
import type { MeetGreetSlot } from "@/types/meet-and-greet";
import { proposeTime } from "../api/meetings";
import { SlotChoices } from "../components/slot-choices";
import { useMeetChange } from "../hooks/use-meet-change";
import { MEET_NOTE_MAX, meetNote, validateMeetNote } from "../schemas/meetings";
import { slotPlace } from "../schemas/slots";
import { AddSlotDialog } from "./add-slot-dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  requestId: number;
  petName: string;
  /** The slot the pet booked. */
  current: MeetGreetSlot;
  /** The human's other open slots, soonest first. */
  slots: MeetGreetSlot[];
  /** The booking was already confirmed: proposing calls a scheduled meeting off until a new time is confirmed. */
  confirmed: boolean;
  /** The proposal is sent. The dialog has closed; the caller confirms with a toast and shows where it stands. */
  onProposed: (slot: MeetGreetSlot) => void;
};

const UNKNOWN_PROBLEM = "We couldn't send your proposal. Check your connection and try again.";

// MG-06 Propose another time: the human offers the pet a different open slot, with an optional message (FR11). The
// pet's booking ends and the pet books again, the offered slot or any other. A time that isn't a slot yet is added
// here first, without losing what was typed. The API decides whether the slot can still be offered (SEC-FE-05).
export function ProposeTimeDialog(props: Props) {
  // Mounted only while open, so every visit starts with nothing chosen or typed.
  return props.open ? <ProposeTimeDialogContent {...props} /> : null;
}

function ProposeTimeDialogContent({ onClose, requestId, petName, current, slots, confirmed, onProposed }: Props) {
  const [picked, setPicked] = useState("");
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  // Slots added from here, until the page behind has read them from the API too.
  const [added, setAdded] = useState<MeetGreetSlot[]>([]);
  const [adding, setAdding] = useState(false);
  const { busy, problem, setProblem, run } = useMeetChange(UNKNOWN_PROBLEM);

  const all = [...slots, ...added.filter((slot) => !slots.some((known) => known.id === slot.id))].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const chosen = all.find((slot) => String(slot.id) === picked) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSlotError(chosen ? null : "Choose one of your open slots.");
    const found = validateMeetNote(message, "message");
    setMessageError(found);
    if (!chosen || found) return;

    const done = await run(
      () => proposeTime(api, requestId, { slotId: chosen.id, message: meetNote(message) }),
      (fields, text) => {
        setSlotError(fields.proposed_slot_id ?? null);
        setMessageError(fields.message ?? null);
        if (!fields.proposed_slot_id && !fields.message) setProblem(text);
      },
    );
    if (!done) return;
    onClose();
    onProposed(chosen);
  }

  // One dialog at a time: adding a slot takes this one's place and hands the new slot back, already chosen.
  if (adding) {
    return (
      <AddSlotDialog
        open
        onClose={() => setAdding(false)}
        onAdded={(slotsAdded) => {
          setAdded((known) => [...known, ...slotsAdded]);
          setPicked(String(slotsAdded[0].id));
          setSlotError(null);
        }}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Propose another time"
      subtitle={`${petName} booked ${formatMeetingTime(current.starts_at)} at ${slotPlace(current)}.`}
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={all.length === 0} loading={busy} loadingLabel="Sending your proposal">
            Send proposal
          </Button>
        </>
      }
    >
      {all.length === 0 ? (
        <Alert tone="info" title="You have no other open slots">
          Add the time you’d like to offer {petName}.
        </Alert>
      ) : (
        <SlotChoices
          legend={`Offer ${petName} a different slot`}
          name="proposed_slot_id"
          slots={all}
          value={chosen ? picked : ""}
          onChange={setPicked}
          error={slotError}
          disabled={busy}
        />
      )}

      <Button variant="tertiary" size="sm" className="self-start" aria-haspopup="dialog" onClick={() => setAdding(true)} disabled={busy}>
        Add a new slot
      </Button>

      <Field label={`Message to ${petName}`} optional error={messageError}>
        <Textarea
          name="message"
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MEET_NOTE_MAX}
          placeholder="e.g. Sunday morning works better for us."
          readOnly={busy}
        />
      </Field>

      <p className="text-sm text-ink-muted">
        {petName} books the time you offer, or picks another of your open slots.
        {confirmed && " Until a new time is confirmed the meeting isn’t scheduled, and contact details are hidden again."}
      </p>

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
