# Pawfolio HiFi design system

Visual layer on top of the approved LoFi (`docs/design/lofi/`). Layout, structure, flows and features come from the LoFi;
this file sets colour, type, shape and their rules. Values live in **`frontend/src/styles/tokens.css`**; the Tailwind names
are mapped in `frontend/src/app/globals.css`. A live reference renders at **`/design-tokens`** in development
(`npm run dev`); it returns 404 in production builds.

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

## Rules

1. **Components use role names, not ramps.** `bg-surface`, `text-ink-muted`, `bg-primary`, `border-line-strong`. The
   `blue-*`, `yellow-*` and `gray-*` utilities exist for illustrations and charts only.
2. **No raw values in components.** Tailwind's default palette, radii, shadows and type sizes are switched off, so
   `bg-zinc-500`, `rounded-2xl` and `text-[#333]` don't work. If a value is missing, add a token.
3. **One filled primary action per area** (blue). Secondary actions are outlined, tertiary are text only.
4. **Yellow is for good news.** Hired, Adopted, Furparent and the match meter. Don't use it for decoration.
5. **Shadows only on things that float** (bars when stuck, menus, dialogs, toasts). Cards use a 1 px `line` border.
6. **Radius grows with the size of the thing:** badge 4 px → control 8 px → card 12 px → dialog 20 px; buttons and chips are pills.

## Status badges

Shape says whether a status is still moving; colour says what kind of ending it is. Every badge shows its status name.

| Utility | Look | Statuses |
| --- | --- | --- |
| `badge-progress` | Dashed gray outline | Pending Verification, Resubmitted, Active, Draft, Looking for a Home, In Process, Sent, On Hold, Approved, Meet Scheduled, Open to Adopt, Open |
| `badge-celebrate` | Solid yellow, dark text | Hired, Adopted, Furparent |
| `badge-attention` | Solid blue, white text | Awaiting Decision; labels such as Decision needed, Overdue |
| `badge-closed` | Solid dark gray, white text | Denied, Suspended, Deactivated, Declined, Not Adopted, Withdrawn, Expired, Resolved |

The mapping lives in `frontend/src/constants/status-badges.ts`; use `<StatusBadge status="Hired" />` rather than
choosing a tone by hand.

## Typography

| Role | Family | Why |
| --- | --- | --- |
| Headings (`font-display`) | **Zilla Slab**, 600 and 700 | A slab serif reads like a stamped pet ID tag or a typed résumé, which fits the job-hunting idea behind Pawfolio. It feels human and trustworthy without being childish, and stays clear at card-title sizes |
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
| Widths | `max-w-content` 1128 · `max-w-narrow` 760 · `max-w-dialog` 520 · `w-sidebar` 240 |
| Touch | Minimum 44 × 44 px (`min-h-11`) |
| Layers | `--pf-z-sticky` 40 · `dropdown` 60 · `drawer` 90 · `dialog` 100 · `toast` 120 — use as `z-(--pf-z-dialog)` |
| Motion | `--pf-duration-fast` 120 ms · `base` 200 ms · `slow` 320 ms; `ease-out`. Reduced-motion turns transitions off globally |

## Accessibility

- **Contrast (WCAG AA), checked for every pair in use:** body text 17:1 on surface, 15.6:1 on canvas. Muted text is
  6.4:1 or better on every surface. Primary-button label 7.9:1, celebrate badge 11:1, danger text 6.6:1. Control borders
  are 4.4:1 (minimum 3:1).
- **Focus:** every interactive element gets a 3 px yellow halo inside a 2 px `blue-700` ring on `:focus-visible`, set once
  in `globals.css`. The blue ring is at least 6.5:1 against white, canvas and yellow; against blue fills, the yellow halo
  separates it.
- **Colour never works alone:** badges carry text; alerts carry an icon and text.

## Not in scope yet

- Dark mode. LoFi has no dark designs. The tokens are ready for it: a dark theme would redefine the semantic variables
  in `tokens.css`.
- Brand mark. The "P" tile on `/design-tokens` is a placeholder.
