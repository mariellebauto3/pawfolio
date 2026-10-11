"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatAgeMonths } from "@/lib/utils/format-age";
import type { Pet } from "@/types/pet";
import { sendInvite } from "../api/invites";
import { INVITE_NOTE_MAX, inviteNote, validateInviteNote } from "../schemas/invites";
import { MatchChip } from "../components/match-chip";
import type { SentInvite } from "../types/invites";

/** The few details of the pet the dialog shows above the note. */
export type InvitedPet = Pick<Pet, "id" | "name" | "breed" | "approximate_age_months" | "city" | "photos">;

type Props = {
  open: boolean;
  onClose: () => void;
  pet: InvitedPet;
  /** The human's match with this pet, when there is one. */
  score?: number;
  /**
   * The invite is out: the API accepted it, or said one from this home is already live. The dialog has closed; the
   * caller confirms with a toast, since a toast can't be seen while a dialog is open.
   */
  onSent: (invite: SentInvite | null) => void;
};

const UNKNOWN_PROBLEM = "We couldn't send your invite. Check your connection and try again.";

// RQ-01 Invite to Apply: a human nudges a pet to apply, like a recruiter reaching out. The pet decides whether to
// send a request. Only the note is sent: the pet comes from the page and the home is the sender's own. The API
// checks the rules (Open to Adopt on, the pet still Looking for a Home, one live invite) and its refusal is shown
// here in its own words (SEC-FE-05).
export function InviteToApplyDialog(props: Props) {
  // Mounted only while open, so every visit starts with an empty note.
  return props.open ? <InviteToApplyDialogContent {...props} /> : null;
}

function InviteToApplyDialogContent({ onClose, pet, score, onSent }: Props) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Open to Adopt is off, or the quiz isn't finished: both are fixed from the human's own Home Profile.
  const [notOpen, setNotOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const facts = [pet.breed, formatAgeMonths(pet.approximate_age_months), pet.city].filter(Boolean).join(" · ");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);
    setNotOpen(false);

    const found = validateInviteNote(note);
    setNoteError(found);
    if (found) return;

    setBusy(true);
    try {
      const invite = await sendInvite(api, pet.id, inviteNote(note));
      onClose();
      onSent(invite);
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "validation") return setNoteError(failure.fieldErrors.note ?? failure.message);
      // Their invite is already with the pet, which is what they wanted: show that, not an error.
      if (failure.code === "invite_already_sent") {
        onClose();
        return onSent(null);
      }
      setNotOpen(failure.code === "not_open_to_adopt");
      setProblem(failure.kind === "not_found" ? `${pet.name}’s resume isn’t available any more.` : failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invite ${pet.name} to apply`}
      subtitle="An invite is a nudge. The pet decides whether to send an adoption request."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingLabel="Sending your invite">
            Send invite
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        {/* The name is written beside it, so the photo isn't read out as well. */}
        <Avatar name={pet.name} src={pet.photos[0]?.url} alt="" size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-display text-xl font-semibold wrap-break-word">{pet.name}</p>
          <p className="text-sm text-ink-muted">{facts}</p>
        </div>
        <MatchChip score={score} />
      </div>

      <Field label="Personal note" optional error={noteError} hint={`${pet.name} reads this with your invite.`}>
        <Textarea
          name="note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={INVITE_NOTE_MAX}
          placeholder="e.g. Your resume made us smile. We’d love to meet you!"
          disabled={busy}
        />
      </Field>

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <Icon name="lock" className="mt-0.5 size-4 shrink-0" />
        Your Home Profile is attached. Your address and phone number stay private.
      </p>

      {problem && (
        <Alert
          tone="error"
          announce
          action={
            notOpen && (
              <Link href={ROUTES.me} className="text-sm font-bold underline">
                Go to your Home Profile
              </Link>
            )
          }
        >
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
