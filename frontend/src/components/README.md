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
