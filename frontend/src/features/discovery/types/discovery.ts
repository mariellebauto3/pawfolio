import type { IsoDateTime, Paginated } from "@/types/api";
import type { HomeProfile } from "@/types/home-profile";
import type { Dealbreaker } from "@/types/match";
import type { Pet } from "@/types/pet";
import type { SearchTotals } from "../schemas/search";

// What the discovery endpoints add to the public pet resume and Home Profile (docs/api/discovery.md). The private
// fields a confirmed Meet & Greet unlocks (contact numbers, the street address) may ride along on a profile; they
// are not part of these types and no discovery screen reads them (SEC-PRIV-02).

/** How the viewer and the profile they are reading fit. The same score is shown to both sides. */
export type MatchEvaluation = {
  passed_dealbreakers: boolean;
  /** Empty when they all passed. */
  failed_dealbreakers: Dealbreaker[];
  /** 0 to 100; 0 when a dealbreaker failed. */
  score: number;
  /** Up to three sentences, written by the API. */
  reasons: string[];
};

type Listed = {
  /** The viewer's score with this profile; left out when there isn't one (quiz not finished, resume in Draft). */
  match_score?: number;
  is_bookmarked?: boolean;
};

/** A pet on a Browse card (DS-01). */
export type PetListing = Pet & Listed;

/** A Home Profile on a Browse card (DS-02). */
export type HomeListing = HomeProfile & Listed;

/** A pet's resume as someone else reads it (DS-05, DS-08). `match` is there for a human who finished the quiz. */
export type PetProfile = PetListing & { match?: MatchEvaluation };

/** A Home Profile as someone else reads it (DS-07). `match` is there for a pet whose resume is published. */
export type HomeProfileDetail = HomeListing & { match?: MatchEvaluation };

export const POST_TYPES = ["for_hire", "hired", "update", "post", "adoption_story"] as const;
export type PostType = (typeof POST_TYPES)[number];

/** A post in the search results: enough to recognise it and open it (DS-03). */
export type SearchPost = {
  id: number;
  type: PostType;
  title: string | null;
  body: string | null;
  author_name: string | null;
  created_at: IsoDateTime | null;
};

/** What the search page shows: the first few of each kind, or one kind a page at a time. */
export type SearchView =
  | { kind: "all"; pets: Pet[]; homes: HomeProfile[]; posts: SearchPost[] }
  | { kind: "pets"; page: Paginated<Pet> }
  | { kind: "homes"; page: Paginated<HomeProfile> }
  | { kind: "posts"; page: Paginated<SearchPost> };

/** `GET /search`, either way it is asked: the words, how many there are of each kind, and the open view. */
export type SearchResults = {
  query: string;
  totals: SearchTotals;
  view: SearchView;
};
