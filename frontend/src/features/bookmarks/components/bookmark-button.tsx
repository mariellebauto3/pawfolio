"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useBookmark } from "../hooks/use-bookmark";
import type { BookmarkTarget } from "../types/bookmarks";

type Props = {
  target: BookmarkTarget;
  /** Whose profile it is, so each button on a page says what it saves. */
  name: string;
  /** `is_bookmarked` as the API sent it with the profile. */
  saved: boolean;
};

// Bookmark on a resume (FR8) or a Home Profile (FR23). Pressing it saves, pressing it again removes, and a toast
// confirms either (BM-03). The filled mark and the word both change, so the state never rests on the icon alone.
export function BookmarkButton({ target, name, saved: initiallySaved }: Props) {
  const { saved, pending, toggle } = useBookmark(target, initiallySaved);

  return (
    <Button
      icon={<Icon name="bookmark" className="size-4 shrink-0" fill={saved ? "currentColor" : "none"} />}
      loading={pending}
      loadingLabel={saved ? "Removing from Bookmarks" : "Saving to Bookmarks"}
      onClick={toggle}
    >
      {saved ? "Bookmarked" : "Bookmark"}
      <span className="sr-only">{saved ? `: ${name}. Press to remove from Bookmarks` : ` ${name}`}</span>
    </Button>
  );
}
