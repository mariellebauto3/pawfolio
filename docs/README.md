# Pawfolio Documentation

What to build lives here; how to build it lives in `project-rules/`.

| Folder | Purpose | What belongs here |
| --- | --- | --- |
| `proposal/` | The approved system proposal | `Pawfolio_System_Proposal.pdf` (concept, account types, status rules, FR1–FR41, NFR1–NFR9, modules) |
| `requirements/` | Requirements broken down for development | `module-map.md` (modules ↔ LoFi IDs ↔ FRs ↔ folders); later: user stories, acceptance criteria |
| `design/lofi/` | Approved low-fidelity designs | Desktop and mobile PDFs. The clickable source is `lofi-prototype/` (regenerate with `node scripts/make-pdf.mjs [--device mobile]`) |
| `design/hifi/` | High-fidelity designs (next phase) | Visual design system, colours, typography, HiFi mockups or Figma links |
| `architecture/` | How the system fits together | System context and deployment diagrams, auth flow, environment overview |
| `database/` | Data model | ERD, table descriptions, status-transition diagrams |
| `api/` | API reference for the Laravel backend | One file per module listing endpoints (method, path, role, request, response, errors, FR) |
| `decisions/` | Architecture Decision Records (ADRs) | Short numbered records of important choices and why they were made |

Keep documents in Markdown where possible so they can be reviewed in pull requests.
