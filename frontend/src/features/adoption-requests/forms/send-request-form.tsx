"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { Textarea } from "@/components/forms/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { MAX_OPEN_REQUESTS } from "@/constants/adoption-requests";
import { ROUTES, homeProfilePath, requestPath } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { getOwnRequests, sendRequest } from "../api/requests";
import { RequestSent } from "../components/request-sent";
import { ApplyBlockedDialog } from "../dialogs/apply-blocked-dialog";
import { APPLY_BLOCKER_CODES, type ApplyBlocker, applyStateFor, isApplyBlocker } from "../schemas/apply-state";
import { CARETAKER_NOTES_MAX, COVER_LETTER_MAX, COVER_LETTER_MIN, requestBody, validateCaretakerNotes, validateCoverLetter } from "../schemas/requests";
import type { SentRequest } from "../types/requests";

type Props = {
  home: { id: number; full_name: string };
  /** The pet that applies, as its resume names it: what goes with the request without being typed. */
  pet: { name: string; photo_url: string | null; facts: string | null };
  /** How many requests the pet has open now, so the form can say which one this will be. Null when unknown. */
  openRequests: number | null;
  /** The card that says who the request goes to, rendered by the page. */
  recipient: ReactNode;
};

/** A refusal shown above the buttons, with the way to fix it when there is one. */
type Problem = { message: string; action?: { href: string; label: string } };

const UNKNOWN_PROBLEM = "We couldn't send your request. Check your connection and try again.";

// RQ-03 Send adoption request: the pet's job application. A cover letter in the pet's own voice, the caretaker's
// notes, and the resume and health summary that go with it automatically. Only the two texts are sent: the home
// is the one in the address and the pet is the session's own (SEC-INPUT-04). The API checks the rules of proposal
// §5.5; a refusal that a dialog explains (RQ-05, RQ-06) opens it, and any other is shown here in the API's words.
// Once it is sent, RQ-04 takes the form's place.
export function SendRequestForm({ home, pet, openRequests, recipient }: Props) {
  const [letter, setLetter] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ letter: string | null; notes: string | null }>({ letter: null, notes: null });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [blocker, setBlocker] = useState<ApplyBlocker | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<SentRequest | null>(null);
  const letterBox = useRef<HTMLTextAreaElement>(null);
  const notesBox = useRef<HTMLTextAreaElement>(null);

  if (sent) return <RequestSent homeName={home.full_name} sent={sent} />;

  /** Shows what was wrong with the texts and moves to the first of them. */
  function showFieldErrors(found: { letter: string | null; notes: string | null }) {
    setErrors(found);
    (found.letter ? letterBox : notesBox).current?.focus();
  }

  /**
   * A rule stopped the request since the page was rendered. The pet's requests say which, and with what: the three
   * that are open, the day the cooldown ends, or the request it already has with this home.
   */
  async function explain(message: string) {
    try {
      const state = applyStateFor({ id: home.id, is_open_to_adopt: true }, await getOwnRequests(api), new Date());
      if (isApplyBlocker(state)) return setBlocker(state);
      if (state.kind === "open") return setProblem({ message, action: { href: requestPath(state.requestId), label: "View my request" } });
    } catch {
      // The API's own sentence still says why.
    }
    setProblem({ message });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);

    const found = { letter: validateCoverLetter(letter), notes: validateCaretakerNotes(notes) };
    if (found.letter || found.notes) return showFieldErrors(found);
    setErrors(found);

    setBusy(true);
    try {
      setSent(await sendRequest(api, home.id, requestBody(letter, notes)));
    } catch (failure) {
      if (!isApiError(failure)) setProblem({ message: UNKNOWN_PROBLEM });
      else if (failure.kind === "validation") {
        const fields = { letter: failure.fieldErrors.cover_letter ?? null, notes: failure.fieldErrors.caretaker_notes ?? null };
        if (fields.letter || fields.notes) showFieldErrors(fields);
        else setProblem({ message: failure.message });
      } else if (failure.kind === "not_found") setProblem({ message: `${home.full_name}’s Home Profile isn’t available any more.` });
      else if (failure.code && APPLY_BLOCKER_CODES.includes(failure.code)) await explain(failure.message);
      else if (failure.code === "pet_resume_draft") setProblem({ message: failure.message, action: { href: ROUTES.resumeEdit, label: "Finish your resume" } });
      else setProblem({ message: failure.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-narrow flex-col">
      <Link href={homeProfilePath(home.id)} className="mb-4 inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-primary hover:underline md:min-h-0">
        <Icon name="chevron-left" className="size-4 shrink-0" />
        Back to {home.full_name}’s Home Profile
      </Link>
      <PageHeader title="Send an adoption request" description="Like a job application: a short cover letter, and your resume goes with it." />

      <div className="flex flex-col gap-4">
        {recipient}

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-card border border-line bg-surface p-4 md:p-5">
          <Field
            label="Cover letter: why I’d fit your home"
            required
            error={errors.letter}
            hint={`Write in first person, as ${pet.name}. Say what makes you a fit, like your energy and their routine. ${COVER_LETTER_MIN} to ${COVER_LETTER_MAX} characters.`}
          >
            <Textarea
              ref={letterBox}
              name="cover_letter"
              rows={7}
              value={letter}
              onChange={(event) => setLetter(event.target.value)}
              minLength={COVER_LETTER_MIN}
              maxLength={COVER_LETTER_MAX}
              placeholder={`Hi ${home.full_name.split(" ")[0]}! I’m ${pet.name}, and…`}
              readOnly={busy}
            />
          </Field>

          <Field label="Caretaker’s notes" optional error={errors.notes} hint="Anything the human should know from the person looking after you: routines, quirks, pickup details.">
            <Textarea
              ref={notesBox}
              name="caretaker_notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={CARETAKER_NOTES_MAX}
              readOnly={busy}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold">Attached automatically</p>
            <ul className="flex flex-col gap-2 sm:flex-row">
              <li className="flex min-w-0 flex-1 items-center gap-3 rounded-control border border-line px-3 py-2">
                {/* The name is written beside it, so the photo isn't read out as well. */}
                <Avatar name={pet.name} src={pet.photo_url ?? undefined} alt="" size="md" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold wrap-break-word">{pet.name}’s resume</span>
                  {pet.facts && <span className="text-sm text-ink-muted">{pet.facts}</span>}
                </span>
              </li>
              <li className="flex items-center gap-3 rounded-control border border-line px-3 py-2 sm:flex-none">
                <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-primary-soft text-primary-soft-ink">
                  <Icon name="heart" className="size-5" />
                </span>
                <span className="font-bold">Health summary</span>
              </li>
            </ul>
          </div>

          <p className="flex items-start gap-2 text-sm text-ink-muted">
            <Icon name="info" className="mt-0.5 size-4 shrink-0" />
            <span>
              {openRequests !== null && `This will be open request ${Math.min(openRequests + 1, MAX_OPEN_REQUESTS)} of ${MAX_OPEN_REQUESTS}. `}
              One request per home at a time.
            </span>
          </p>

          {problem && (
            <Alert
              tone="error"
              announce
              action={
                problem.action && (
                  <Link href={problem.action.href} className="text-sm font-bold underline">
                    {problem.action.label}
                  </Link>
                )
              }
            >
              {problem.message}
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Link href={homeProfilePath(home.id)} className={buttonClasses()}>
              Cancel
            </Link>
            <Button type="submit" variant="primary" loading={busy} loadingLabel="Sending your request">
              Send request
            </Button>
          </div>
        </form>
      </div>

      {blocker && <ApplyBlockedDialog open onClose={() => setBlocker(null)} blocker={blocker} homeName={home.full_name} />}
    </div>
  );
}
