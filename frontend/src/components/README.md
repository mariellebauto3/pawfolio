# Shared components

Reusable, **feature-agnostic** UI building blocks taken from the LoFi UI kit (desktop PDF pages 7–8).
If a component is only used by one module, it belongs in `src/features/<module>/` instead.

| Folder | Purpose | Planned components (from the LoFi UI kit) |
| --- | --- | --- |
| `ui/` | Basic building blocks | Button (primary / secondary / ghost / small), Badge (status, solid), Tag, Card, Avatar & photo placeholder, Meter |
| `forms/` | Form controls | Field (text, select, textarea), Locked field, File upload, Choice chips, Radio cards, Toggle, Checkbox, Wizard + Stepper |
| `overlays/` | Things that sit on top of the page | Modal, Confirm dialog, Drawer, Dropdown menu, Toast, Photo viewer (lightbox) |
| `feedback/` | Status and messages | Alert, Banner, Empty state, Error state, Loading skeleton |
| `data-display/` | Showing records | Table, Timeline, Stat tile (KPI), Chat thread bubbles, Status chain |
| `layout/` | Page shells | Guest shell, Member shell, Admin shell, Account-status shell, Page header, Footer |
| `navigation/` | Moving around | Guest top bar, Member top bar, Me menu (GN-01), Alerts dropdown (NT-01), Admin sidebar, Tabs, Pagination, Back link |

Global screens: **GN-01** (top navigation · Me menu) → `navigation/`; **GN-02** (Page not found) → `src/app/not-found.tsx` using `feedback/`.

## Built (FE-02)

### `ui/`

| Component | File | Use it for |
| --- | --- | --- |
| `Button` | `button.tsx` | `variant`: `primary` (one per area), `secondary` (outlined, default), `tertiary` (text), `destructive` (confirm button inside a confirmation dialog only). `size`: `md`, `sm` (44 px on phones, 36 px from `md`). `loading` keeps focus, shows a spinner and ignores clicks |
| `buttonClasses()` | `button-styles.ts` | Styling a `next/link` `<Link>` as a button, also from server components |
| `Badge` | `badge.tsx` | A label in one of the four tones (`progress`, `celebrate`, `attention`, `closed`), e.g. "Decision needed" |
| `StatusBadge` | `status-badge.tsx` | A status by its exact proposal name; the tone comes from `src/constants/status-badges.ts` |
| `Tag` | `tag.tsx` | Descriptive, non-interactive labels (traits, match reasons); optional leading `icon` |
| `Card` | `card.tsx` | Content block on the canvas: optional `title`, `description`, `action`; `padding="none"` for edge-to-edge photos |
| `Avatar` | `avatar.tsx` | Round photo of a pet or human; initials when there is no photo. Sizes `sm` 32, `md` 40, `lg` 56, `xl` 96 |
| `Photo` | `photo.tsx` | Fixed-ratio photo or placeholder: `ratio="pet"` (4:3), `"cover"` (3:1 → 5:1), `"square"` |
| `Icon` | `icon.tsx` | The SVG icon set (check, x, lock, chevron-down, upload, file, alert, paw, user, spinner). Never emoji |

### Conventions

- **`className` is for layout** (margin, width, grid placement). `cn()` in `src/lib/utils/cn.ts` doesn't resolve
  conflicting utilities, so don't restyle a component through it; add a prop or a variant instead.
- **Client boundary.** `Button` is `"use client"`; `Badge`, `StatusBadge`, `Tag`, `Card`, `Avatar`, `Photo` and
  `Icon` stay server-safe.
- **Photos from the API** go through `next/image`; add the storage host to `images.remotePatterns` in `next.config.ts`
  when the API serves them.
