import Link from "next/link";
import { PetResume } from "@/components/data-display/pet-resume";
import { Banner } from "@/components/feedback/banner";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { ROUTES, petPath, resumeEditPath } from "@/constants/routes";
import { formatDate } from "@/lib/utils/format-date";
import type { Pet } from "@/types/pet";
import { firstOpenStep } from "../schemas/resume-schemas";
import type { ActivityPost, OwnPet } from "../types/own-pet";
import { ShareResumeButton } from "./share-resume-button";

type Props = {
  pet: OwnPet;
  /** The pet's latest posts; null when they couldn't be loaded. */
  posts: ActivityPost[] | null;
  /** Published pets of the same species; null when they couldn't be loaded. */
  similar: Pet[] | null;
};

// PR-01 My resume, as the pet sees it, and PR-02 its Draft state. There is no way to change the status here: a
// Draft goes live through Publish in the wizard, and every later change is the system's (FR27).
export function MyResume({ pet, posts, similar }: Props) {
  const draft = pet.status === "draft";
  const { completeness } = pet;

  return (
    <PetResume
      pet={pet}
      owner
      notice={
        draft && (
          <Banner
            tone="neutral"
            icon="pencil"
            title="Your resume is a Draft"
            actions={
              <Link href={resumeEditPath(firstOpenStep(completeness) + 1)} className={buttonClasses({ variant: "primary", size: "sm" })}>
                Continue editing
              </Link>
            }
          >
            <p>Drafts are hidden from search and matches.{completeness.missing.length > 0 && " To go live:"}</p>
            {completeness.missing.length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {completeness.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>Everything is filled in. Publish it from the last step.</p>
            )}
          </Banner>
        )
      }
      actions={
        <>
          <Link href={ROUTES.resumeEdit} className={buttonClasses({ variant: draft ? "secondary" : "primary" })}>
            Edit resume
          </Link>
          <Link href={ROUTES.stats} className={buttonClasses({ variant: "secondary" })}>
            View stats
          </Link>
          {/* A Draft has no public page to share yet. */}
          {!draft && <ShareResumeButton path={petPath(pet.id)} />}
        </>
      }
      aside={
        <>
          <Card title="Profile strength" as="section">
            <Meter value={completeness.strength_percent} label="Profile strength" size="lg" tone="neutral" unit="complete" />
            <p className="text-sm">{completeness.missing[0] ?? "Your resume has everything it needs."}</p>
          </Card>

          <Card title="Latest activity" as="section">
            {posts === null ? (
              <p className="text-sm text-ink-muted">Your posts couldn&apos;t load just now.</p>
            ) : posts.length === 0 ? (
              <p className="text-sm text-ink-muted">You haven&apos;t posted yet. Share an update from the feed.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {posts.map((post) => (
                  <li key={post.id} className="flex flex-col gap-0.5 text-sm">
                    <span className="line-clamp-2">{post.text}</span>
                    <time dateTime={post.created_at} className="text-ink-muted">
                      {formatDate(post.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
            <Link href={ROUTES.memberHome} className="text-sm font-bold text-primary underline-offset-4 hover:underline">
              See all posts
            </Link>
          </Card>

          <Card title="Similar pets" as="section">
            {similar === null ? (
              <p className="text-sm text-ink-muted">Similar pets couldn&apos;t load just now.</p>
            ) : similar.length === 0 ? (
              <p className="text-sm text-ink-muted">No similar pets are looking for a home right now.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {similar.map((other) => (
                  <li key={other.id} className="flex items-center gap-3">
                    <Avatar name={other.name} src={other.photos[0]?.url} alt="" size="md" />
                    <span className="flex min-w-0 flex-col">
                      <Link href={petPath(other.id)} className="truncate font-bold underline-offset-4 hover:underline">
                        {other.name}
                      </Link>
                      <span className="truncate text-sm text-ink-muted">{other.breed}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      }
    />
  );
}
