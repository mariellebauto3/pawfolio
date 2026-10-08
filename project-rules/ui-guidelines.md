# UI / UX Guidelines

The approved LoFi designs are the reference: `docs/design/lofi/Pawfolio_LoFi_UI_Designs.pdf` (desktop) and
`..._Mobile.pdf` (phone). The clickable version is in `lofi-prototype/` (`npm run dev`, then "All screens").
Every screen, dialog and state has an ID (e.g. `MG-11`); use it in branches, PRs and code comments where helpful.

## 1. Screens and layouts

- **Two target layouts:** desktop at 1440 × 900 and phone at 390 × 844. Everything in between must reflow without horizontal
  page scrolling. Tables may scroll sideways inside their card on phones.
- **Page shells** (see `frontend/src/components/layout/`):
  - *Guest shell* — visitor top bar (Home, How it works, Success stories, FAQ, Join now, Sign in) + footer. Screens
    `AU-01`–`AU-17`. Home was added 2026-10-03 (not in the LoFi) for visitors who don't know the logo is a link; it and
    the logo both scroll back to the hero when the landing page is already open.
  - *Account-status shell* — minimal bar with Help center and Log out only. Pending, Denied, Suspended accounts see nothing else (`AU-18`–`AU-21`).
  - *Member shell* — top bar: logo, search, Home, Pets for You / Homes for You, Browse, Requests, Alerts, Me. Max content width 1128 px.
  - *Admin shell* — left sidebar (Dashboard, Verification, Reports, Requests & Meets, Resolve Issues, Accounts & Alumni,
    Announcements, Activity Logs) with counts.
- **Phone adaptations** (as in the mobile PDF, except the navigation, below): feed side rails are hidden; request detail
  shows the action panel first; dialogs become full width; multi-column grids become one column.
- **Navigation below `lg`** (changed 2026-10-02 from the mobile LoFi's crowded top tabs and wrapped admin strip):
  - *Visitor* (below `md`, added 2026-10-03): the top bar holds the logo and a menu button; Home, How it works,
    Success stories, FAQ, Join now and Sign in open in a drawer. Visitors pass through once, so one tap more is fine.
  - *Member:* the top bar keeps the logo mark, search and the Me avatar; Home, Matches, Browse, Requests and Alerts move
    to a tab bar fixed to the bottom of the screen, with their counts. No hamburger: these are the screens members
    return to all day, so they stay one tap away.
  - *Admin:* a top bar with the current section and a menu button that opens the sidebar's links, counts and Log out
    in a drawer.
- The pet's and human's shells are the same; content changes by role. Pets see "Homes for You", humans "Pets for You".

## 2. Visual language

- LoFi is grayscale on purpose. The HiFi design system (`docs/design/hifi/README.md`) sets colour, fonts and shape:
  **blue, yellow and gray**, the colours dogs see. Values live once in `frontend/src/styles/tokens.css`; components use role
  names (`bg-surface`, `text-ink-muted`, `bg-primary`), never raw colours or the brand ramps.
- Meaning travels on the blue ↔ yellow axis. Red is only for errors and destructive actions; yellow is for good news
  (Hired, match score), always as a fill with dark text.
- **Buttons by emphasis:** one primary (filled) action per area; secondary (outlined); tertiary (text only). Destructive
  actions are never primary by default and always confirmed.
- **Status badges:** outlined (dashed) for in-progress statuses; solid for final or highlighted ones (Hired, Adopted, Furparent,
  Decision needed). Use the exact status names from the proposal. Tones: `badge-progress`, `badge-celebrate`,
  `badge-attention`, `badge-closed` (which status gets which: `docs/design/hifi/README.md`).
- Image placeholders keep their aspect ratios: covers wide, avatars round, pet photos 4:3.

## 3. Components (reuse before creating)

Use the shared components listed in `frontend/src/components/README.md`: Button, Badge, Tag, Card, Field, Choice chips,
Radio cards, Toggle, Checkbox, File upload, Stepper/Wizard, Tabs, Pagination, Modal, Drawer, Dropdown, Toast, Alert, Banner,
Empty state, Table, Timeline, Meter, Match card, Post card. Add a new shared component only when two or more features need it.

## 4. Forms

- Long forms are **wizards** with a visible step indicator and "Step X of N" (NFR1): sign-up (5 steps), resume (6), Home Profile & quiz (6).
- Show helper text under fields (e.g. "Only your city is shown publicly"); show errors inline next to the field.
- Verified fields (name, species, breed, age; human name, birthdate) render as **Locked** with a "Request a change" path (`AC-03`).
- Required reasons (deny, suspend, cancel meeting, resolve issue) block the confirm button until filled.
- Never lose user input on validation errors; keep "Save draft" where the LoFi shows it.

## 5. Dialogs, menus and feedback

- Use a **dialog** for: confirmations of irreversible or important actions (Adopt, Withdraw, Deactivate, Suspend, Delete post),
  short forms (Invite to Apply, Report, Add slot), and explanations (Match breakdown). Everything else is a page.
- **Log out always asks first** (added 2026-10-04, not in the LoFi): every "Log out", for every role and in every
  shell, opens "Log out of Pawfolio?" with Stay signed in and Log out, so a slip doesn't end the session.
- **Confirming a Meet & Greet asks first** (added 2026-10-08, not in the LoFi's `MG-05`): Confirm opens "Confirm
  this Meet & Greet?", which says that each side's contact details are shared, because what is seen can't be unseen.
- Dialog anatomy: title, optional subtitle, close button, body, footer with actions — cancel on the left, primary on the right.
- Permanent actions say so in the dialog ("This is permanent") and list what will happen.
- **Toasts** confirm a completed action in one short sentence (bottom-left on desktop, full width at the bottom on phones) and
  auto-dismiss after ~5 s.
- **Empty states** explain why it's empty and offer the next step (e.g. "Take the lifestyle quiz").
- **Error states** say what happened and how to recover; never show raw error codes or stack traces.

## 6. Rules the UI must reflect

- Show only actions the current user may take: Adopt/Decline appear only after the meeting time; booking only after approval;
  Apply is replaced by "View my request" when one is open; limit (3 open) and 30-day cooldown dialogs explain blocks (`RQ-05`, `RQ-06`).
- No status dropdowns anywhere for pets or requests (FR27).
- Contact details and exact addresses appear only on a confirmed Meet & Greet (`MG-07`).
- Match scores always come with their top reasons and a way to see the breakdown (`MT-03`).

## 7. Copy and tone

- Pets speak in **first person** on their own screens ("Your request to Ana", "Share an update, Mochi…").
- Friendly, short, plain language. Sentence case for headings and buttons ("Send request", not "SEND REQUEST").
- Buttons name the action ("Approve request", "Book this slot"), not "OK" or "Submit" (except final wizard steps).
- Keep the job-hunting metaphor consistent: resume, apply, cover letter, Hired, alumni.

## 8. Accessibility

- All interactive elements are reachable and usable by keyboard, with a visible focus style.
- Dialogs trap focus, close on Escape and return focus to the trigger.
- Every image has meaningful `alt` text (pet name + context) or `alt=""` if decorative.
- Text contrast meets WCAG AA; never rely on colour alone to show a status (badges carry text).
- Form fields have labels; errors are announced (`aria-describedby`, `aria-live` for toasts).
- Minimum touch target 44 × 44 px on phones.
