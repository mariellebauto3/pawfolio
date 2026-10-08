import type { IsoDateTime } from "@/types/api";
import type { HomeProfile } from "@/types/home-profile";
import type { Pet } from "@/types/pet";

// What the bookmarks endpoints answer (docs/api/bookmarks-and-invites.md). A human saves pets and a pet saves homes,
// so each account reads one kind of row.

/** The profile a bookmark points at, as the two remove endpoints name it. */
export type BookmarkTarget = { kind: "pet"; id: number } | { kind: "home"; id: number };

type Saved = {
  /** The bookmark's own id. */
  id: number;
  created_at: IsoDateTime | null;
};

/** The viewer's score with a saved profile; left out when there isn't one. */
type Scored = { match_score?: number };

/** A pet a human saved (BM-01). */
export type SavedPet = Saved & { pet: Pet & Scored };

/** A home a pet saved (BM-02). */
export type SavedHome = Saved & { home_profile: HomeProfile & Scored };
