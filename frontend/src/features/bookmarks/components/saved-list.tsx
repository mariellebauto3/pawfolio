"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { HomeCard } from "@/components/data-display/home-card";
import { PetCard } from "@/components/data-display/pet-card";
import { Button } from "@/components/ui/button";
import { useBookmark } from "../hooks/use-bookmark";
import type { BookmarkTarget, SavedHome, SavedPet } from "../types/bookmarks";
import { NoBookmarks } from "./no-bookmarks";

type Props =
  | { kind: "pets"; rows: SavedPet[]; total: number }
  | { kind: "homes"; rows: SavedHome[]; total: number };

// Three cards across on a desktop, two on a tablet, one on a phone.
const CARD_SIZES = "(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw";

function countLabel(total: number, kind: Props["kind"]): string {
  const noun = kind === "pets" ? (total === 1 ? "saved pet" : "saved pets") : total === 1 ? "saved home" : "saved homes";
  return `${total} ${noun}`;
}

// The cards of the Bookmarks screen (BM-01, BM-02). Removing one takes its card away at once and asks the server
// for the page again, so the count and the next page's cards follow. The removed ids are remembered here because
// the answer may still hold the row for a moment.
export function SavedList(props: Props) {
  const { kind, total } = props;
  const router = useRouter();
  const [removed, setRemoved] = useState<readonly number[]>([]);
  const summary = useRef<HTMLParagraphElement>(null);

  const rows = props.rows.filter((row) => !removed.includes(row.id));
  const left = total - (props.rows.length - rows.length);

  function handleRemoved(bookmarkId: number) {
    setRemoved((ids) => [...ids, bookmarkId]);
    // The button that had focus is gone with its card; the count is the next thing worth hearing.
    summary.current?.focus();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <p ref={summary} tabIndex={-1} role="status" className="text-sm text-ink-muted">
        {countLabel(left, kind)}
      </p>

      {rows.length === 0 ? (
        <NoBookmarks kind={kind} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kind === "pets"
            ? (rows as SavedPet[]).map(({ id, pet }) => (
                <li key={id} className="flex flex-col gap-1">
                  <div className="flex-1">
                    <PetCard pet={pet} score={pet.match_score} sizes={CARD_SIZES} titleAs="h2" />
                  </div>
                  <RemoveButton target={{ kind: "pet", id: pet.id }} name={pet.name} onRemoved={() => handleRemoved(id)} />
                </li>
              ))
            : (rows as SavedHome[]).map(({ id, home_profile: home }) => (
                <li key={id} className="flex flex-col gap-1">
                  <div className="flex-1">
                    <HomeCard home={home} score={home.match_score} titleAs="h2" />
                  </div>
                  <RemoveButton target={{ kind: "home", id: home.id }} name={home.full_name} onRemoved={() => handleRemoved(id)} />
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}

function RemoveButton({ target, name, onRemoved }: { target: BookmarkTarget; name: string; onRemoved: () => void }) {
  const { pending, remove } = useBookmark(target, true, onRemoved);

  return (
    <Button variant="tertiary" size="sm" className="self-end" loading={pending} loadingLabel="Removing from Bookmarks" onClick={remove}>
      Remove
      <span className="sr-only"> {name} from Bookmarks</span>
    </Button>
  );
}
