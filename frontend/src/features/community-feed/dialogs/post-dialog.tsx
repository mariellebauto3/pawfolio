"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { FileUpload } from "@/components/forms/file-upload";
import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { POST_TYPE_LABELS, POST_TYPE_TONES } from "@/constants/posts";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/utils/format-date";
import type { Post, PostType } from "@/types/post";
import { createAdoptionStory, createPost, updatePost } from "../api/feed";
import { MAX_POST_PHOTOS, POST_TITLE_MAX, type PostFormMode, bodyMaxFor, hasTitleField, photoError, validatePostForm } from "../schemas/posts";
import type { FeedViewer, StoryPet } from "../types/feed";

type Props = {
  open: boolean;
  onClose: () => void;
  /** A new post (FD-03), a new adoption story (FD-04), or the words of the viewer's own post (FD-06 "Edit post"). */
  mode: PostFormMode;
  viewer: FeedViewer;
  /** `story`: the pets this Furparent adopted, to choose from. */
  pets?: StoryPet[];
  /** `edit`: the post as it stands. */
  post?: Post;
  /** It is posted or saved, and the dialog has closed. The caller shows it and confirms with a toast. */
  onDone: (post: Post) => void;
};

const COPY = {
  post: { title: "Create a post", submit: "Post", busy: "Posting" },
  story: { title: "Write an adoption story", submit: "Post story", busy: "Posting your story" },
  edit: { title: "Edit post", submit: "Save changes", busy: "Saving your changes" },
} as const satisfies Record<PostFormMode, { title: string; submit: string; busy: string }>;

const UNKNOWN_PROBLEM = "We couldn't reach Pawfolio. Check your connection and try again.";
const TOO_LARGE = "Those photos are too large to send together. Remove one, or choose smaller files, and try again.";

// FD-03 Create post and FD-04 Write an adoption story, and the same form reopened on a post to edit its words. Who
// posts and what type the post gets are the session's and the API's to say (SEC-AUTHZ-02, FR27): the badge here only
// shows what it will be. Whether this human may tell this pet's story is the API's to check too, whatever the list
// offered (SEC-FE-05). A refusal leaves everything typed in place.
export function PostDialog(props: Props) {
  // Mounted only while open, so every visit starts from the post as it stands, or from an empty form.
  return props.open ? <PostDialogContent {...props} /> : null;
}

function PostDialogContent({ onClose, mode, viewer, pets = [], post, onDone }: Props) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  // One adopted pet is the usual case: it is already chosen.
  const [petId, setPetId] = useState(pets.length === 1 ? String(pets[0].id) : "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const copy = COPY[mode];

  // A field's error is about what it held when it was checked: it goes as soon as the field is changed.
  function clearErrors(isField: (field: string) => boolean) {
    setErrors((current) => (Object.keys(current).some(isField) ? Object.fromEntries(Object.entries(current).filter(([field]) => !isField(field))) : current));
  }
  const type: PostType = post?.type ?? (mode === "story" ? "adoption_story" : viewer.role === "pet" ? "update" : "post");
  const withTitle = hasTitleField(mode, post);
  const isStory = type === "adoption_story";
  const firstPerson = viewer.role === "pet" && !isStory;

  async function send(): Promise<Post> {
    if (mode === "edit" && post) {
      const saved = await updatePost(api, post.id, withTitle ? { body, title } : { body });
      // An edit changes the words only: the likes, the comments and the photos are the ones already on screen.
      return { ...post, title: saved.title, body: saved.body };
    }
    if (mode === "story") return createAdoptionStory(api, { petId: Number(petId), title, body, photos });
    return createPost(api, { body, photos });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = validatePostForm(mode, { title, body, petId }, post);
    setErrors(found);
    setProblem(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const done = await send();
      onClose();
      onDone(done);
    } catch (failure) {
      setBusy(false);
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind === "validation") {
        setErrors(failure.fieldErrors);
        // A field this form doesn't show (the API's own wording for it) still has to be said somewhere.
        const shown = ["body", "title", "adopted_pet_id"].some((field) => field in failure.fieldErrors) || photoError(failure.fieldErrors) !== null;
        if (!shown) setProblem(failure.message);
        return;
      }
      if (failure.kind === "not_found") return setProblem("This post isn’t available any more.");
      setProblem(failure.kind === "payload_too_large" ? TOO_LARGE : failure.message);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={copy.title}
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingLabel={copy.busy}>
            {copy.submit}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <Avatar name={viewer.name} src={viewer.avatarUrl ?? undefined} alt="" />
        <p className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold wrap-break-word">{viewer.name}</span>
          <span className="text-sm text-ink-muted">Visible to everyone on Pawfolio</span>
        </p>
        <Badge tone={POST_TYPE_TONES[type]}>{POST_TYPE_LABELS[type]}</Badge>
      </div>

      {mode === "story" && (
        <Field label="Adopted pet" error={errors.adopted_pet_id} required>
          <Select
            name="adopted_pet_id"
            value={petId}
            onChange={(event) => {
              setPetId(event.target.value);
              clearErrors((field) => field === "adopted_pet_id");
            }}
            placeholder="Choose a pet"
            options={pets.map((pet) => ({ value: String(pet.id), label: pet.adoptedAt ? `${pet.name}, adopted ${formatDate(pet.adoptedAt)}` : pet.name }))}
            disabled={busy}
          />
        </Field>
      )}

      {withTitle && (
        <Field label="Title" error={errors.title} required>
          <Input
            name="title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              clearErrors((field) => field === "title");
            }}
            maxLength={POST_TITLE_MAX}
            placeholder="How Luna applied to our home"
            autoComplete="off"
            disabled={busy}
          />
        </Field>
      )}

      <Field
        label={isStory ? "Your story" : firstPerson ? `What’s new, ${viewer.name}?` : "What’s new?"}
        hint={firstPerson ? "Write as the pet, in first person: “I wore my best bandana today.”" : isStory ? "How you met, the first days at home, how they are doing now." : undefined}
        error={errors.body}
        required
      >
        <Textarea
          name="body"
          rows={isStory ? 7 : 5}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            clearErrors((field) => field === "body");
          }}
          maxLength={bodyMaxFor(type)}
          placeholder={isStory ? "It started with a cover letter…" : firstPerson ? "Share an update…" : "Share something with the community…"}
          disabled={busy}
        />
      </Field>

      {mode === "edit" ? (
        post && post.photos.length > 0 && <p className="text-sm text-ink-muted">Photos stay as they are. To change them, delete the post and share it again.</p>
      ) : (
        <FileUpload
          label="Photos"
          optional
          multiple
          maxFiles={MAX_POST_PHOTOS}
          accept={["jpg", "png"]}
          error={photoError(errors)}
          onFilesChange={(files) => {
            setPhotos(files);
            clearErrors((field) => field === "photos" || field.startsWith("photos."));
          }}
        />
      )}

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
