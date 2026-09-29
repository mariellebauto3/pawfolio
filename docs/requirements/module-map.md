# Module map

How each system module (proposal §9) maps to LoFi screens, functional requirements (§7) and code folders.
Generated from `lofi-prototype/src/book/specs.js` — the same source as the LoFi PDFs.

| # | Module | LoFi IDs (count) | Requirements | Frontend feature | Backend module folder |
| --- | --- | --- | --- | --- | --- |
| 1 | Authentication & Verification | `AU` (26) | FR1, FR2, FR18, FR19, FR33, FR34 | `frontend/src/features/auth` | `Auth` |
| 2 | Profile Management | `PR` (20) | FR3, FR4, FR13, FR20, FR27 | `frontend/src/features/profiles` | `Profiles` |
| 3 | Discovery & Search | `DS` (8) | FR6, FR7, FR8, FR9, FR22, FR23, FR24, FR28 | `frontend/src/features/discovery` | `Discovery` |
| 4 | Matching & Suggestions | `MT` (5) | FR3, FR5, FR20, FR21 | `frontend/src/features/matching` | `Matching` |
| 5 | Bookmarks | `BM` (4) | FR8, FR23 | `frontend/src/features/bookmarks` | `Bookmarks` |
| 6 | Adoption Requests | `RQ` (19) | FR9, FR10, FR12, FR24, FR25, FR30, FR36, FR37 | `frontend/src/features/adoption-requests` | `AdoptionRequests` |
| 7 | Meet & Greet | `MG` (16) | FR11, FR12, FR25, FR26, FR36 | `frontend/src/features/meet-and-greet` | `MeetAndGreet` |
| 8 | Adoption & Alumni | `AL` (9) | FR12, FR13, FR14, FR28, FR29, FR37, FR38 | `frontend/src/features/adoption` | `Adoption` |
| 9 | Notifications | `NT` (5) | FR15, FR31, FR39 | `frontend/src/features/notifications` | `Notifications` |
| 10 | Community Feed & Stories | `FD` (7) | FR14, FR17, FR29 | `frontend/src/features/community-feed` | `CommunityFeed` |
| 11 | Reports & Moderation | `RP` (5) | FR16, FR32, FR34, FR35 | `frontend/src/features/reports` | `Reports` |
| 12 | Account Administration | `AC` (10) | FR34 | `frontend/src/features/accounts` | `Accounts` |
| 13 | Analytics | `AN` (3) | FR5, FR10, FR30, FR40 | `frontend/src/features/analytics` | `Analytics` |
| 14 | Activity Logs | `LG` (4) | FR41 | `frontend/src/features/activity-logs` | `ActivityLogs` |
| — | Navigation & global | `GN` (2) | — | `frontend/src/components/navigation`, `layout` | — |

The backend module folder name is used under `app/Http/Controllers/Api/V1/`, `app/Http/Requests/`, `app/Http/Resources/`,
`app/Services/`, `app/Actions/`, `tests/Feature/` and `tests/Unit/`.
