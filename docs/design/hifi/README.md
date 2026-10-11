# Pawfolio HiFi design system

Visual layer on top of the approved LoFi (`docs/design/lofi/`). Layout, structure, flows and features come from the LoFi;
this file sets colour, type, shape and their rules. Values live in **`frontend/src/styles/tokens.css`**; the Tailwind names
are mapped in `frontend/src/app/globals.css`. Live references render at **`/design-tokens`** (tokens) and **`/ui-kit`**
(shared components, listed in `frontend/src/components/README.md`) in development (`npm run dev`); both return 404 in
production builds.

## Palette: what a dog sees

Pawfolio exists mainly to get dogs adopted, so the palette is the one dogs see. Dogs have two kinds of colour cones,
with peaks near 430 nm (blue-violet) and 555 nm (yellow); everything else reads as gray. Red and green, which dogs can't
tell apart, also fail for about 1 in 12 men, so building on the blue ↔ yellow axis makes the interface clearer for
colour-blind people too.

| Ramp | Anchor | Character | Used for |
| --- | --- | --- | --- |
| Blue | `blue-600` | Leans violet, where dogs see colour best | Primary actions, links, focus ring, "someone must act" |
| Yellow | `yellow-400` | Sunflower / tennis-ball yellow | Celebration (Hired), match score, highlights, warnings. Always a fill with dark text, never text on white |
| Gray | `gray-50` … `gray-900` | Cool, slightly blue | Canvas, surfaces, text, lines, closed states |
| Red | `red-700`, `red-800` (hover) | Functional only | Errors and destructive actions, always with text or an icon |

Success has no green: confirmations use the blue soft tone, and the check icon plus the message carry the meaning.

### Brand moments (public pages)

The landing page (`AU-01`) is allowed more play than the app screens, still inside the same palette:

| Token | Utility | Value | Used for |
| --- | --- | --- | --- |
| `--pf-sky` | `bg-sky` | `blue-100` | The round badge behind the hero dog's head (the O of PAWFOLIO). The hero itself sits on the plain `canvas`, with a frosted `surface` panel behind the dog |
| `--pf-sky-soft` | `bg-sky-soft` | `blue-50` | Illustration wells on tiles (How it works, Recently Hired placeholders) |
| `--pf-surface-brand` | `bg-surface-brand` | `blue-900` | A full-width brand band (the verification promise) |
| `--pf-ink-on-brand`, `--pf-ink-on-brand-muted` | `text-ink-on-brand`, `text-ink-on-brand-muted` | white, `blue-200` (8:1) | Text on that band. Its button is the white `secondary` one |

On `sky`, ink is 13:1, primary 6.1:1 and muted ink 5.9:1 (AA); on the band, white is 14.5:1. Decorative drawings (tennis ball, bone,
sparkles, step pictures) live in `features/auth/components/landing/landing-illustrations.tsx`, use the ramps
directly as illustrations may, and are hidden from screen readers.

## Rules

1. **Components use role names, not ramps.** `bg-surface`, `text-ink-muted`, `bg-primary`, `border-line-strong`. The
   `blue-*`, `yellow-*` and `gray-*` utilities exist for illustrations and charts only.
2. **No raw values in components.** Tailwind's default palette, radii, shadows and type sizes are switched off, so
   `bg-zinc-500`, `rounded-2xl` and `text-[#333]` don't work. If a value is missing, add a token.
3. **One filled primary action per area** (blue). Secondary actions are outlined, tertiary are text only.
4. **Yellow is for good news.** Hired, Adopted, Furparent, the match meter and the match tab on a card's corner
   (`MatchCard`, written out as "86% match"). Don't use it for decoration in the UI
   (buttons, text, backgrounds, borders). The one exception is drawings on public pages, where a tennis ball or a
   sparkle may be yellow (see "Brand moments"). On light surfaces a yellow fill gets an `accent-edge` (`yellow-600`)
   outline so the bar's edge stays visible; never use it for text. The one exception is `text-accent-display`
   (`yellow-600`, 3.2:1 on white) for a yellow word in a large display heading, 24 px bold or bigger, such as
   "Questions" in the landing FAQ. Lighter yellows (`yellow-400` 1.5:1, `yellow-500` 2.0:1) are never text.
5. **Shadows only on things that float** (bars when stuck, menus, dialogs, toasts). Cards use a 1 px `line` border.
6. **Radius grows with the size of the thing:** badge 4 px → control 8 px → card 12 px → dialog 20 px; buttons and chips are pills.

## Brand mark

A paw whose toes spell **F-O-L-I-O** over a yellow pad, so the mark itself reads "Paw-folio".
Converted 1:1 from the designer's vector file into `frontend/public/images/brand/pawfolio-mark.svg` (master),
`src/app/icon.svg` (browser tab) and `src/app/apple-icon.png` (home-screen icon, on white).

- In the UI, use `<Logo>` (mark + "Pawfolio" wordmark) or `<BrandMark>` alone (`src/components/navigation/`). Size it by
  height; the mark is 1.16 × wider than tall. **Never smaller than 48 px tall:** below that the F-O-L-I-O letters blur
  together on 1× screens. Bars use 48 px (`size="bar"`), the footer 56 px (`size="lg"`). The wordmark stays beside
  it, or is screen-reader text when hidden on phones.
- Its colours are the UI's own: `--pf-brand-mark-blue` = `blue-600` (`#3341C2`, the primary blue) and
  `--pf-brand-mark-yellow` = `yellow-400` (`#FCCB1A`, the Hired yellow). The original file used a brighter violet
  (`#4C3DFF`) and amber (`#FDB813`); those were 7–9 ΔE2000 away from the UI colours, close enough to look like a
  mistake next to the buttons, so the mark was matched to the system (2026-10-03). The static copies (`icon.svg`, the
  master SVG) carry the same two values as hex; change all three together.
- Give it clear space of at least a quarter of its height, and don't recolour, stretch or rotate it.

## Status badges

Shape says whether a status is still moving; colour says what kind of ending it is. Every badge shows its status name.

| Utility | Look | Statuses |
| --- | --- | --- |
| `badge-progress` | Dashed gray outline | Pending Verification, Resubmitted, Active, Draft, Looking for a Home, In Process, Sent, On Hold, Approved, Meet Scheduled, Open to Adopt, Open |
| `badge-celebrate` | Solid yellow, dark text | Hired, Adopted, Furparent |
| `badge-attention` | Solid blue, white text | Awaiting Decision; labels such as Decision needed, Overdue |
| `badge-closed` | Solid dark gray, white text | Denied, Suspended, Deactivated, Declined, Not Adopted, Withdrawn, Closed, Expired, Resolved |

The mapping lives in `frontend/src/constants/status-badges.ts`; use `<StatusBadge status="Hired" />` rather than
choosing a tone by hand.

## Typography

| Role | Family | Why |
| --- | --- | --- |
| Headings (`font-display`) | **Zilla Slab**, 600 and 700 | A slab serif reads like a stamped pet ID tag or a typed resume, which fits the job-hunting idea behind Pawfolio. It feels human and trustworthy without being childish, and stays clear at card-title sizes |
| Everything else (`font-sans`) | **Atkinson Hyperlegible Next** | Designed for low-vision readers; distinct letterforms (Il1, 0O) for a broad audience including older adopters |

Scale (rem, 16 px body): `xs` 13 · `sm` 14 · `base` 16 · `lg` 18 · `xl` 21 · `2xl` 26 · `3xl` 34 · `4xl` 44 · `5xl` 56.
Headings use `font-semibold` (600) or `font-bold` (700) only; Zilla Slab has no heavier weight, so `font-extrabold`
would be faked by the browser. Line heights are built into each size. Nothing is smaller than 13 px; body text on phones is 16 px. Keep reading text under
about 65 characters per line (`max-w-[65ch]`).

Both fonts are self-hosted through `next/font` (no requests to Google from the browser). The build prints
"Failed to find font override values for Atkinson Hyperlegible Next": `next/font` has no fallback metrics for this family
yet, so it skips size-adjusting the fallback font. That's harmless, apart from a small text shift while the font loads.

## Shape, depth, spacing, layers, motion

| Group | Tokens |
| --- | --- |
| Radius | `rounded-badge` 4 · `rounded-control` 8 · `rounded-card` 12 · `rounded-dialog` 20 · `rounded-pill` |
| Shadow (tinted blue-950) | `shadow-raised` · `shadow-menu` · `shadow-dialog` · `shadow-toast` |
| Spacing | Tailwind's 4 px grid (`p-4` = 16 px). Page padding: `px-gutter` (16 px phone, 24 px from `md`) |
| Widths | `max-w-content` 1128 · `max-w-narrow` 760 · `max-w-dialog` 520 · `max-w-dialog-wide` 640 · `max-w-drawer` 460 · `w-toast` 416 · `w-sidebar` 240 |
| Bars | `--pf-topbar-h` 64 · `--pf-bottom-nav-h` 64 (member tab bar on phones). `--pf-bottom-offset` is the room fixed bottom bars take (0 unless the tab bar shows); toasts and page ends sit above it |
| Touch | Minimum 44 × 44 px (`min-h-11`) |
| Layers | `--pf-z-sticky` 40 · `dropdown` 60 · `drawer` 90 · `dialog` 100 · `toast` 120 — use as `z-(--pf-z-dialog)` |
| Motion | `--pf-duration-fast` 120 ms · `base` 200 ms · `slow` 320 ms; `ease-out`. Reduced-motion turns transitions off globally |
| Entrances | `animate-dialog-in` (fade + lift), `animate-sheet-in` (phone dialogs, from the bottom), `animate-drawer-in` (from the right), `animate-menu-in`, `animate-toast-in`, `animate-fade-in` (backdrops). Motion only answers an action; exits are instant. `animate-link-in` then `animate-stamp-in` play once on the two adoption celebrations (`AL-02`, `AL-03`): the yellow line between a pet and its Furparent draws in, and the Hired tag is stamped on it. Exception: the landing hero (`AU-01`). Its paw trail walks without end (`animate-paw-loop`, a marquee that pauses on hover), and a story loop tells the adoption story every 7 s while the hero is on screen (`landing-motion.ts`, `use-story-cycle.ts`): the offer chip (after React Bits "Call Chip") runs its timer and rolls to a yellow check, then the "loved" heart (after "Pulse Heart") beats to solid yellow. Clicking the heart stops the loop. On the first run only, the lanyard card turns over to show "Furever home". Reduced motion shows the end states and never loops |

## Charts

Used on the stats pages and the admin dashboard (`AN-01`…`AN-03`, `frontend/src/features/analytics/components/`).
No chart library: bars are HTML, the line chart is one SVG.

- **Blue counts, yellow celebrates, gray is over or not yet.** A plain count is `bg-primary`. What the product
  calls good news is the yellow fill with its edge, as on a badge: Hired, Adopted, a match score. Draft, Declined,
  Withdrawn and Expired are gray (`bg-ink-subtle`). The same thing has the same colour on every chart.
- **Lines:** `blue-300` dashed (Sent), `blue-600` (Approved), `yellow-600` (Adopted), 2 px. The three were checked
  for colour-blind separation and contrast on white; `blue-300` is below 3:1, which is why it is the dashed one and
  why the chart carries a table. Three series at most; a fourth is another chart.
- **A value is always written.** Bars and columns show their number, the stacked bar has a list with every count,
  and the line chart has a readout (pointer, or ← → from the keyboard) and a table for screen readers. Numbers and
  labels are ink, never the series colour.
- **One baseline, one scale.** Bars start at zero; a chart never has two y-axes. The scale ends on a round number
  that halves cleanly (`niceMax`), so the middle line is a whole number.
- **Marks are thin and quiet:** 12 px bars on a sunken track, 4 px rounded ends, a 2 px gap between the parts of a
  stacked bar, grid lines in `line`, the baseline in `line-strong`. Nothing animates on load.

## Accessibility

- **Contrast (WCAG AA), checked for every pair in use:** body text 17:1 on surface, 15.6:1 on canvas. Muted text is
  6.4:1 or better on every surface. Primary-button label 7.9:1, celebrate badge 11:1, danger text 6.6:1. Control borders
  are 4.4:1 (minimum 3:1).
- **Focus:** every interactive element gets a 3 px yellow halo inside a 2 px `blue-700` ring on `:focus-visible`, set once
  in `globals.css`. The blue ring is at least 6.5:1 against white, canvas and yellow; against blue fills, the yellow halo
  separates it. Controls whose real `<input>` is visually hidden (checkbox, toggle, chips, radio cards) show the same
  style on their drawn part with the `focus-ring` utility (`peer-focus-visible:focus-ring`).
- **Colour never works alone:** badges carry text; alerts carry an icon and text.

## Not in scope yet

- Dark mode. LoFi has no dark designs. The tokens are ready for it: a dark theme would redefine the semantic variables
  in `tokens.css`.
