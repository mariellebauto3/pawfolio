# Feature: Community Feed & Stories (Module 10)

One social feed for everyone: automatic “For Hire” and “Hired” posts, pet updates (also after adoption), human posts
and adoption stories.

- **LoFi screen IDs:** `FD-xx` — see `docs/design/lofi/` (desktop and mobile PDFs).
- **Backend counterpart:** `backend/app/**/CommunityFeed/`
- **API:** `docs/api/community-reports-and-admin.md`, "Community Feed" and "The feed as the screens use it"
- **Who does what (proposal §9):** Human — Post, react, comment · Pet — Post updates · Admin — Moderate

## Folders

| Folder | Holds |
| --- | --- |
| `components/` | Feature-specific UI pieces used by this module's screens (cards, panels, lists). |
| `dialogs/` | Modals, drawers, confirmation dialogs and dropdown menus owned by this module. |
| `forms/` | Form and multi-step wizard components for this module. |
| `hooks/` | React hooks for this module (data loading, UI state). |
| `api/` | Functions that call the Laravel API endpoints for this module. |
| `schemas/` | Client-side validation schemas mirroring the backend Form Requests. |
| `types/` | TypeScript types specific to this module. |

## Screens, dialogs and states to build

| ID | Name | Type | Role | Route | Status |
| --- | --- | --- | --- | --- | --- |
| FD-01 | Community feed (human) | Screen | Human | `/feed` | Built (FE-20) |
| FD-02 | Community feed (pet) | Screen | Pet | `/feed` | Built (FE-20) |
| FD-03 | Create post dialog | Dialog | Human, Pet | `/feed` | Built (FE-20) |
| FD-04 | Write an adoption story | Dialog | Human (Furparent) | `/feed`, `/feed?compose=story` | Built (FE-20) |
| FD-05 | Post detail & comments | Screen | Human, Pet | `/posts/[postId]` | Built (FE-20) |
| FD-06 | Post options menu | Dropdown | Human, Pet | `/feed`, `/posts/[postId]` | Built (FE-20); Report added with FE-21 |
| FD-07 | Delete post dialog | Dialog | Human, Pet | `/feed`, `/posts/[postId]` | Built (FE-20) |

Dialogs, menus, toasts and states render on top of (or inside) the route shown; they are not separate pages.

## Built (FE-20)

| What | Where |
| --- | --- |
| The calls: the feed a page at a time, one post with its comments, post, adoption story, edit, delete, comment, reply, remove a comment, like. A row that doesn't match the contract is left out | `api/feed.ts` |
| The form rules that mirror the API's limits, the post id read from the address | `schemas/posts.ts` |
| A like: shown at once, set by the API's answer, put back on a refusal; one press at a time | `hooks/use-like.ts` |
| `Feed`: the composer, the list, "Show more posts", and the dialogs it opens | `components/feed.tsx` |
| `FeedPost`: a post with Like, Comment, Share and its ••• menu (`FD-06`) | `components/feed-post.tsx` |
| `PostThread`: a post's page with the comment box, comments, replies and their dialogs (`FD-05`) | `components/post-thread.tsx`, `comment-item.tsx`, `forms/comment-form.tsx` |
| Create post, adoption story and edit: one form in three modes (`FD-03`, `FD-04`) | `dialogs/post-dialog.tsx` |
| Delete post (`FD-07`) and remove comment | `dialogs/delete-post-dialog.tsx`, `delete-comment-dialog.tsx` |
| The three columns, the mini profile, the suggestions and the announcements | `components/feed-layout.tsx`, `feed-profile-card.tsx`, `feed-suggestions-card.tsx`, `feed-announcements.tsx` |
| The author and their other posts, beside a post | `components/post-aside.tsx` |
| Loading skeletons | `components/feed-skeletons.tsx` |
| The pages (Server Components) | `src/app/(member)/feed/page.tsx`, `src/app/(member)/posts/[postId]/page.tsx` |

The card itself is shared: `PostCard` and `PostPhotos` in `src/components/data-display/`, with the post type in
`src/types/post.ts` and its labels in `src/constants/posts.ts`.

- **FD-01 and FD-02 are one page.** The API lists the same posts for everyone; the composer's words, the mini
  profile, the suggestions ("Pets for You" or "Homes for You") and the adoption story button differ by role.
- **Newest first, a page at a time.** The server renders the first 20 posts; "Show more posts" adds the next page
  in the browser, and a post already on screen isn't shown twice when new posts have pushed it down a page.
- **The type and the author are never sent.** The API makes an Update for a pet and a Post for a human, and posts
  For Hire and Hired by itself (FR27, FR28). The badge in the form only shows what the post will be.
- **Who may write an adoption story.** The button shows for a human whose own Home Profile lists adopted pets, and
  the API checks the adoption whatever was sent (FR14, SEC-FE-05). "Write an adoption story" on an alumni profile,
  an adoption's details and the Furparent dialog leads to `/feed?compose=story`, which opens the form.
- **Words are text.** Titles, posts, comments and names are rendered as text; nothing in them becomes markup or a
  link (SEC-FE-01, SEC-FE-02). An author's name links to their resume or Home Profile only when the API says this
  viewer may open it (`is_profile_viewable`).
- **Edit changes the words only.** The API keeps a post's photos, so the edit form has no photo picker.
- **Comment** on the feed opens the post's page with the comment box ready; the comments are read there. Replies
  go one level deep. A comment can be deleted by its author and by the author of the post it is on.
- **Share copies the post's link.** "Save post" from the LoFi's menu is left out: nothing stores it and no
  requirement asks for it.
- **The side rails are extras.** They are read from the account's own profile, matches, invites and bookmarks; one
  that can't be read is left out and the feed still shows. Below `lg` they are hidden, and the latest announcement
  moves above the posts.
- **Report** (`RP-01`, FE-21) is on everyone else's posts and comments, never on the reader's own: "Report post"
  and "Report this account" in the post menu (`feed-post.tsx`), and Report among a comment's actions
  (`comment-item.tsx`). They call `useReport()` (`src/providers/report-provider.tsx`); the dialog itself belongs
  to the Reports module.

## Requirements covered

- **FR14** — Furparent views the alumni profile and adoption details, and posts adoption stories.
- **FR17** — Post in the community feed, react and comment.
- **FR29** — Post updates to the community feed, including after adoption.
