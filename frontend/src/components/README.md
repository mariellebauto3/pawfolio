# Shared components

Reusable, **feature-agnostic** UI building blocks taken from the LoFi UI kit (desktop PDF pages 7–8).
If a component is only used by one module, it belongs in `src/features/<module>/` instead.

A live reference of everything built so far renders at **`/ui-kit`** in development (`npm run dev`); like
`/design-tokens`, it returns 404 in production builds.

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

## Built (FE-02, FE-03)

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
| `Icon` | `icon.tsx` | The SVG icon set (after Lucide): status, arrows, actions (pencil, trash, flag, bookmark, bell, log-out…), states (inbox, search, wifi-off). Never emoji |
| `IconButton` | `icon-button.tsx` | Round 44 × 44 px button with only an icon. `label` is required (screen readers, tooltip). `tone="inverse"` on dark or coloured fills |
| `Meter` | `meter.tsx` | Match % (MT-02/03). `size="lg"`: big number over a yellow bar; `size="sm"`: breakdown row with `format="fraction"` ("12 / 15"). `tone="neutral"` (blue) for anything that isn't a match. The value is always written out |

### `forms/`

| Component | File | Use it for |
| --- | --- | --- |
| `Field` | `field.tsx` | Label, helper text and inline error around **one** control. Wires `htmlFor`, `aria-describedby` and `aria-invalid` automatically. `optional` adds "(optional)" |
| `Fieldset` | `fieldset.tsx` | Same for a **group** of controls (legend instead of label), e.g. a list of checkboxes |
| `Input` | `input.tsx` | Text-like inputs. Set `type` and `autoComplete` |
| `Textarea` | `textarea.tsx` | Long text. With `maxLength` it shows "count / max", "N more needed" below `minLength`, and announces thresholds to screen readers |
| `Select` | `select.tsx` | Native select with `options` and an optional `placeholder`. Never for statuses (FR27) |
| `ChoiceChips` | `choice-chips.tsx` | Quick answers (quiz, résumé). Single choice = radios, `multiple` = checkboxes |
| `RadioCards` | `radio-cards.tsx` | One choice where each option needs a line of explanation |
| `Toggle` | `toggle.tsx` | On/off settings that apply right away (Open to Adopt). `labelPosition="start"` for settings rows |
| `Checkbox` | `checkbox.tsx` | Agreements and multi-select lists; whole row is the hit area |
| `LockedField` | `locked-field.tsx` | Admin-verified details, read-only, with "Request a change" (`onRequestChange` or `requestChangeHref`), AC-03 |
| `FileUpload` | `file-upload.tsx` | JPG/PNG/PDF, 5 MB, checked by extension **and** file signature; previews, remove, drag and drop, `multiple` + `maxFiles`. The API still re-validates (SEC-FILE-01…05) |
| `Stepper` | `stepper.tsx` | Progress bars with step labels (labels hidden on phones, always read by screen readers) |
| `Wizard` | `wizard.tsx` | Multi-step form (NFR1): "Step X of N" heading, Back / Next, optional Save draft with `draftStatus`, `onNext` per-step validation. All steps stay mounted so answers survive Back and Next |

### `overlays/`

| Component | File | Use it for |
| --- | --- | --- |
| `Modal` | `modal.tsx` | Confirmations, short forms, explanations (ui-guidelines §5). Controlled: `open` + `onClose`. `title`, `subtitle`, `footer` (cancel first, primary last), `size` `md` 520 / `lg` 640, `onSubmit` wraps body and footer in a form. Bottom sheet on phones |
| `ConfirmDialog` | `confirm-dialog.tsx` | Important or irreversible actions. `confirmLabel` names the action, `destructive`, `consequences` list, `permanent`, required `reason` (confirm stays disabled until filled), `acknowledgement` checkbox. `onConfirm` resolves → closes; throws → stays open with a retry message |
| `Drawer` | `drawer.tsx` | Side panel from the right (460 px, full screen on phones), e.g. Browse filters. Same props as Modal |
| `DropdownMenu` | `dropdown-menu.tsx` | Menu button (GN-01 Me menu, FD-06 post options). `items` with `onSelect` or `href`, `destructive`, `separator`s; optional `header`; `icon` for a ••• trigger or `children` for a text trigger; `align="end"` near the right edge |
| `ToastViewport` | `toast.tsx` | The toast stack. Don't render it yourself — `ToastProvider` does |

**Toasts:** `const toast = useToast(); toast.show("Saved to Bookmarks.")` from any client component
(`src/providers/toast-provider.tsx`, mounted in the root layout). Tones: `success` (default), `info`, `error`. One short
sentence that names what happened. They leave after 5 s and pause while hovered or focused. A modal dialog covers
toasts, so show them after it closes; inside a dialog use `Alert`.

**Dialog keyboard behaviour** (checked in Edge for this PR): focus moves into the dialog (the first field, otherwise
Cancel), Tab and Shift+Tab stay inside, Escape closes, focus returns to the trigger, the page behind doesn't scroll.
Dialogs with typed input don't close on a backdrop click. Nothing closes while an action is running.

### `feedback/`

| Component | File | Use it for |
| --- | --- | --- |
| `Alert` | `alert.tsx` | A message inside a card or form. `tone`: `info`, `success`, `warning`, `error`. `announce` when it appears after an action (errors interrupt, others wait) |
| `Banner` | `banner.tsx` | A message about the whole page: "Hired by …" (`celebrate`), "The meeting time has passed" (`attention`), drafts (`neutral`), announcements (`info`, `onDismiss`). `icon` is an icon name or an element such as an Avatar |
| `EmptyState` | `empty-state.tsx` | Why it's empty, plus the next step (`action`) |
| `ErrorState` | `error-state.tsx` | A view that failed to load. `kind`: `network`, `not-found`, `forbidden`, `server`, each with fixed friendly copy; never shows an error's message or code. `onRetry` (Next's `retry` in `error.tsx`). `errorKindFromStatus(status)` picks the kind |
| `Skeleton`, `SkeletonText`, `SkeletonGroup` | `skeleton.tsx` | Loading placeholders in the shape of the content. Wrap them in one `SkeletonGroup label="Loading …"` |

### `data-display/`

| Component | File | Use it for |
| --- | --- | --- |
| `Table` | `table.tsx` | Admin lists and histories. Typed `columns` (`cell`, `align`, `wrap`, `rowHeader`, `headerHidden`), `rows`, `rowKey`, `empty`. Scrolls sideways inside its own frame on phones, wherever it's placed; `framed={false}` inside a `Card padding="none"` |
| `Timeline` | `timeline.tsx` | Request and adoption history, oldest first. Each event: `title`, `when` + `dateTime`, `description`, `status` (badge + dot) or `tone`, `upcoming`. Dots follow the badges: hollow while moving, yellow Adopted, blue needs a decision, dark gray ended |

### `navigation/`

| Component | File | Use it for |
| --- | --- | --- |
| `Tabs` | `tabs.tsx` | Tabs stored in `?tab=` (linkable, survive reload). The default tab stays out of the URL; changing tab drops `?page`. A server page can read `searchParams.tab` and pass only that tab's `content` |
| `Pagination` | `pagination.tsx` | `?page=` links (server-friendly). Pass `page`, `totalPages` (Laravel `meta`) and the page's `searchParams` so filters and tabs carry over. Numbers on desktop, "Page 2 of 8" on phones |

### Conventions

- **Uncontrolled or controlled.** Form controls work with `defaultValue` / `defaultChecked` (and plain `FormData`) or
  with `value` + `onChange`.
- **`className` is for layout** (margin, width, grid placement). `cn()` in `src/lib/utils/cn.ts` doesn't resolve
  conflicting utilities, so don't restyle a component through it; add a prop or a variant instead.
- **Native inputs everywhere.** Checkboxes, radios and switches are real `<input>`s, visually hidden inside their label;
  the drawn part shows focus with the shared `focus-ring` utility (`peer-focus-visible:focus-ring`).
- **Client boundary.** Components with hooks or handlers are `"use client"`; `Badge`, `StatusBadge`, `Tag`, `Card`,
  `Avatar`, `Photo`, `Icon`, `Meter`, `Stepper`, `Alert`, `Banner`, `EmptyState`, `ErrorState`, `Skeleton`, `Table`,
  `Timeline` and `Pagination` stay server-safe. (`Banner` `onDismiss` and `ErrorState` `onRetry` need a client parent.)
- **Avatars next to a written name** get `alt=""`, so screen readers don't read the name twice.
- **Photos from the API** go through `next/image`; add the storage host to `images.remotePatterns` in `next.config.ts`
  when the API serves them.
