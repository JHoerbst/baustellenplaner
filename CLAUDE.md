# CLAUDE.md

Baustellenplaner: a planner for home renovation and extension projects. Vite + React SPA (`src/`) with an Amplify Gen 2 backend (`amplify/`). README.md (German) describes features, deployment and structure for users.

## Commands

```bash
npm run dev          # without amplify_outputs.json: trial mode with the local store
npx ampx sandbox     # personal backend, writes amplify_outputs.json
npm run typecheck    # frontend (tsc -b) + backend (amplify/tsconfig.json)
npm run build
```

No test setup and no linter; `npm run typecheck` is the verification step.

## Architecture

- `src/lib/store.ts` defines `Store`, the only interface to the data. Two implementations: `localStore` (localStorage + IndexedDB, same file) and `cloudStore` in `src/lib/cloud.tsx` (Amplify, only loaded when a backend exists). Every new data operation needs both.
- `src/lib/app.tsx` holds the project and all tables in React context (`useApp`). Pages read from it and write through `save` or `store`.
- `src/lib/types.ts` mirrors the schema in `amplify/data/resource.ts` by hand; change both together.
- `src/ui/EntityForm.tsx`: one generic form for all tables (field list in, values out; empty inputs become `null`; `showWhen` hides fields conditionally).
- `src/ui/Attachments.tsx`: file list on an entry, also usable before the entry is saved.
- `src/lib/fileUrl.ts`: `useFileUrl` gives a cached URL for showing a stored file in `<img>`.
- `src/ui/PlanViewer.tsx`: zoomable view for plans and photos. PDFs are rendered by pdf.js (lazy-loaded): a low-resolution overview plus a detail canvas that redraws the visible region at screen resolution after each gesture. Images are shown directly.
- Access control: one Cognito group per project (`p-<uuid>`), models use `allow.groupDefinedIn('group')`. `amplify/functions/project` manages groups and invitations, `amplify/functions/files` issues signed S3 URLs; both check membership via `functions/shared/group.ts`.
- Self sign-up is disabled in `backend.ts`; accounts are created by invitation.

## Conventions

- Code, identifiers, comments and commit messages are in English.
- Everything the user sees is German with real umlauts, addressing the user as "du". That includes route paths (`/angebote`, `/zeitplan`), error messages thrown for users, and the trade names in `src/lib/tradeCatalog.ts`.
- Domain glossary: Gewerk = trade, Firma = company, Angebot = quote, Termin = appointment, Aufgabe = task, Einsatz = assignment (a trade's period on site), Helfer = helper, Rechnung = invoice, Notiz = note, Eigenleistung = `selfPerformed`.
- The S3 bucket has `keepOnDelete: true`; do not rename the storage resource.
- Amplify builds with `npm ci`: commit the lockfile after changing dependencies.
