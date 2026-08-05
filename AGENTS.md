# LazySDS

Helps a non-expert worker turn the Safety Data Sheet (SDS) PDF for a product
they're holding into structured rows in a compliance register. Audience:
someone on their phone in a store cupboard who has never heard the acronym
"SDS" — plain language and big tap targets everywhere. Upload-only: the app
does not search for or locate an SDS on the worker's behalf.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS v4, react-router
- **Backend:** Vercel serverless functions in `api/` (no Express)
- **DB + files:** Supabase — Postgres table `sds_index` (one quick-reference
  row per SDS; the older flat `sds_records` from migration 0001 is retired but
  left in place), storage bucket `sds-pdfs`
  - Hosted project: `lazysds` (ref `ijqwxgjlnvatfgduohwo`, ap-southeast-2)
- **AI:** Anthropic API, model `claude-sonnet-5`, called only from
  `api/extract.ts`. Extraction follows the Grampians Community Health
  quick-reference standard (v1.1), with verbatim source evidence and no
  guessing.
- **Hosting:** Vercel — project `lazysds` on team `mullaneaa-7828s-projects`,
  live at https://lazysds.vercel.app. Deploy with `npx vercel --prod`.
  ⚠ TypeScript is pinned to 5.x: Vercel's function builder crashes on TS 7.
- **Region conventions:** Australia (GHS per Safe Work Australia, ADG classes)
- **Email (optional):** `api/send-copy.ts` emails a one-row spreadsheet copy
  plus the source PDF to `REGISTER_NOTIFY_EMAIL` on save, via Resend. Off
  when `RESEND_API_KEY` / `REGISTER_NOTIFY_EMAIL` aren't set.
- **Export (SharePoint-ready):** XLSX exports have a paste-ready `Paste`
  sheet (plain text, no formatting) plus a `Read Me` sheet for the
  disclaimer/docs. `SDS Filename` = `<SDS Record ID>.pdf` (shared
  `shared/sds-id.ts`, never recomputed separately). `SDS Link` = optional
  `VITE_SHAREPOINT_LIBRARY_URL` + filename.

## Commands

```
npm run dev        # frontend only (Vite, /api routes NOT available)
vercel dev         # full stack locally (frontend + api functions)
npm run build      # typecheck + production build
npm run typecheck  # tsc --noEmit
npm test           # vitest, single run
```

## Layout

```
shared/    types + config imported by BOTH src/ and api/
  config/register-columns.ts   ⚠ user-editable: export column mapping
api/       Vercel functions; api/_lib/ holds server-only adapters (not routed)
src/       React app: pages/, components/, lib/
supabase/migrations/           schema source of truth (applied to hosted project)
```

## Hard rules

- **Secrets never reach the browser.** `ANTHROPIC_API_KEY` and all third-party
  keys exist only in Vercel env vars and are used only inside `api/`. Only
  `VITE_`-prefixed vars are bundled client-side, and only the Supabase URL +
  anon key are allowed there.
- **Strict TypeScript, no `any`.** tsconfig enforces it; don't weaken it.
- **One adapter per external service** (`api/_lib/...`). Components never
  contain API-specific code; they call `src/lib/api-client.ts`, which calls
  `/api` routes, which call adapters.
- **Extraction never guesses.** Fields not literally present in the SDS are
  `null`. Nothing is written to the register without a human confirming it
  on the review screen.
- **Imports:** `src/` may use `@/` and `@shared/` aliases. `api/` is bundled
  separately by Vercel and must use relative imports (`../shared/...`)
  ⚠ **with explicit `.js` extensions** (`./schema.js` for `schema.ts`) —
  functions run as native ESM in production and crash with
  ERR_MODULE_NOT_FOUND without them (`vercel dev` won't catch this).

## Access model (deliberate)

No user accounts. Anyone with the URL can read the register and insert
reviewed records (RLS allows anon select+insert only). `reviewed_by` is
typed initials. Updates/deletes happen in the Supabase dashboard. Revisit
if the register becomes sensitive.

## Environment variables

See `.env.example` — it documents every variable and where it's used.
Local: copy to `.env.local`. Production: set in Vercel project settings.

## Build phases (stop after each for user review)

1. ✅ Scaffold + AGENTS.md + Supabase schema + hello-world deploy
2. ✅ Upload → extract (`/api/extract`) → review screen → save
3. ✅ Register list view + CSV/XLSX export
4. ❌ Removed: guided web search + trusted PDF-link fetch (`/find`) and
   barcode scanning (`/scan`) — the app does not search for or locate an
   SDS on the worker's behalf, only read one they supply.
5. ✅ Polish, tests and handoff documentation
