"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { useBookmark } from "../hooks/use-bookmark";
import type { BookmarkTarget } from "../types/bookmarks";

type Props = {
  target: BookmarkTarget;
  /** Whose profile it is, so each button on a page says what it saves. */
  name: string;
  /** `is_bookmarked` as the API sent it with the profile. */
  saved: boolean;
  /** `profile`: a button with its word, on a resume or a Home Profile. `card`: the mark alone, on a match card. */
  placement?: "profile" | "card";
};

// Bookmark on a resume (FR8), a Home Profile (FR23) and a match card (MT-01, MT-02). Pressing it saves, pressing it
// again removes, and a toast confirms either (BM-03). The mark gains a check once saved, and on a profile the word
// changes too, so the state never rests on colour.
export function BookmarkButton({ target, name, saved: initiallySaved, placement = "profile" }: Props) {
  const router = useRouter();
  // A profile shows how many accounts saved it ("Bookmarked by 3"), so it is read again after a change.
  const { saved, pending, toggle } = useBookmark(target, initiallySaved, placement === "profile" ? () => router.refresh() : undefined);
  const icon = saved ? "bookmark-check" : "bookmark";

  if (placement === "card") {
    // One name whatever the state, with the state beside it: a list of these reads "Bookmark Mochi, pressed".
    return <IconButton icon={icon} label={`Bookmark ${name}`} aria-pressed={saved} aria-busy={pending || undefined} onClick={toggle} />;
  }

  return (
    <Button
      icon={<Icon name={icon} className="size-4 shrink-0" />}
      loading={pending}
      loadingLabel={saved ? "Removing from Bookmarks" : "Saving to Bookmarks"}
      onClick={toggle}
    >
      {saved ? "Bookmarked" : "Bookmark"}
      <span className="sr-only">{saved ? `: ${name}. Press to remove from Bookmarks` : ` ${name}`}</span>
    </Button>
  );
}
