"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ChoiceChips } from "@/components/forms/choice-chips";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { Textarea } from "@/components/forms/textarea";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { FieldErrors } from "@/lib/api/errors";
import { philippineToday } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import { PublishAnnouncementDialog } from "../dialogs/publish-announcement-dialog";
import {
  ANNOUNCEMENT_MESSAGE_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  AUDIENCE_OPTIONS,
  type AnnouncementDraft,
  type AnnouncementErrors,
  EMPTY_DRAFT,
  type PublishWhen,
  announcementErrorsFromApi,
  audienceHint,
  readAnnouncementDraft,
  storedToast,
} from "../schemas/announcements";
import type { AnnouncementAudience, AudienceCounts, NewAnnouncement, StoredAnnouncement } from "../types/announcements";

type Props = {
  /** How many Active accounts each audience is, as the API counted them when the page was rendered. */
  counts: AudienceCounts;
};

const WHEN_OPTIONS: { value: PublishWhen; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "later", label: "Schedule for later" },
];

// NT-04 "New announcement": a title, a message, who it is for and when, then "Preview announcement", which opens
// NT-05 with it exactly as it will be sent. Nothing is sent before that dialog's button. The form sends no author
// and no status: both are the API's (SEC-INPUT-04). What is typed stays in the form if the dialog is closed or the
// API refuses a field, and is cleared only once the announcement is stored.
export function AnnouncementForm({ counts }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<AnnouncementDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<AnnouncementErrors>({});
  const [ready, setReady] = useState<NewAnnouncement | null>(null);

  function change(patch: Partial<AnnouncementDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    // A field that is being fixed stops saying it is wrong.
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as keyof AnnouncementErrors];
      if ("when" in patch) {
        delete next.date;
        delete next.time;
      }
      return next;
    });
  }

  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readAnnouncementDraft(draft);
    if ("errors" in read) return setErrors(read.errors);
    setErrors({});
    setReady(read.announcement);
  }

  function stored(announcement: StoredAnnouncement) {
    toast.show(storedToast(announcement));
    setDraft(EMPTY_DRAFT);
    // The list beside the form starts with the new one: back to its first page, read again.
    router.replace(ROUTES.adminAnnouncements, { scroll: false });
    router.refresh();
  }

  function invalid(fieldErrors: FieldErrors) {
    setErrors(announcementErrorsFromApi(fieldErrors));
  }

  const hint = audienceHint(draft.audience, counts);

  return (
    <>
      <form onSubmit={preview} noValidate className="flex flex-col gap-5">
        <Field label="Title" required error={errors.title} hint="The bold line of the alert. Keep it short enough to read at a glance.">
          <Input name="title" value={draft.title} maxLength={ANNOUNCEMENT_TITLE_MAX} autoComplete="off" onChange={(event) => change({ title: event.target.value })} />
        </Field>

        <Field label="Message" required error={errors.message}>
          <Textarea name="message" value={draft.message} rows={5} maxLength={ANNOUNCEMENT_MESSAGE_MAX} onChange={(event) => change({ message: event.target.value })} />
        </Field>

        <Field label="Audience" required error={errors.audience} hint={hint || undefined}>
          <Select name="audience" value={draft.audience} options={AUDIENCE_OPTIONS} onChange={(event) => change({ audience: event.currentTarget.value as AnnouncementAudience })} />
        </Field>

        <ChoiceChips legend="Publish" name="when" options={WHEN_OPTIONS} value={draft.when} onChange={(value) => change({ when: value as PublishWhen })} />

        {draft.when === "later" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" required error={errors.date}>
              <Input type="date" name="date" value={draft.date} min={philippineToday()} onChange={(event) => change({ date: event.target.value })} />
            </Field>
            <Field label="Time" required error={errors.time} hint="Philippine time">
              <Input type="time" name="time" value={draft.time} step={300} onChange={(event) => change({ time: event.target.value })} />
            </Field>
          </div>
        )}

        <Button type="submit" variant="primary" className="self-start">
          Preview announcement
        </Button>
      </form>

      <PublishAnnouncementDialog announcement={ready} counts={counts} onClose={() => setReady(null)} onStored={stored} onInvalid={invalid} />
    </>
  );
}
