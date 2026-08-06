# LazySDS

Helps a non-expert worker turn the Safety Data Sheet (SDS) PDF for a product
they're holding into structured rows in a compliance register. Audience:
someone on their phone in a store cupboard who has never heard the acronym
"SDS" — plain language and big tap targets everywhere. Upload-only: the app
does not search for or locate an SDS on the worker's behalf (no guided web
search, no barcode lookup) — they supply the PDF, the app reads it.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS v4, react-router
- **Backend:** Vercel serverless functions in `api/` (no Express)
- **DB + files:** Supabase — Postgres table `sds_index` (one quick-reference
  row per SDS; the older flat `sds_records` from migration 0001 is retired but
  left in place), storage bucket `sds-pdfs`
  - Hosted project: `lazysds` (ref `ijqwxgjlnvatfgduohwo`, ap-southeast-2)
- **AI:** Anthropic API, model `claude-sonnet-5`, called only from
  `api/extract.ts`. Extraction follows the Grampians Community Health
  quick-reference standard (v1.1): one row per SDS, a condensed set of
  SDS-derived fields (the vocabulary lives in `shared/sds-fields.ts`, each
  tagged `kind: "fact" | "summary"`). Fact fields (identification, dates,
  classification, hazard statements) are copied verbatim; summary fields
  (ppe, first_aid, spill, storage, fire_media) are plain-language summaries
  that still keep numbers, times, temperatures, concentrations and
  "do not"/urgency wording exact. Every value carries a source excerpt +
  location; controlled statuses (never guess); dates/currency computed in
  code, not by the AI.
- **Hosting:** Vercel — project `lazysds` on team `mullaneaa-7828s-projects`,
  live at https://lazysds.vercel.app. Deploy with `npx vercel --prod`.
  ⚠ TypeScript is pinned to 5.x: Vercel's function builder crashes on TS 7.
- **Region conventions:** Australia (GHS per Safe Work Australia, ADG classes)
- **Email (optional):** `api/_lib/email.ts` sends via Resend's HTTP API (no
  SDK), from the verified domain `notify@lazysds.com` (requires lazysds.com
  to be verified in Resend - see `.env.example`). Two features share it:
  `api/send-copy.ts` emails a one-row spreadsheet copy plus the source PDF
  to the fixed `REGISTER_NOTIFY_EMAIL` whenever a record is saved. Off
  entirely when `RESEND_API_KEY` / `REGISTER_NOTIFY_EMAIL` aren't set —
  saving to the register never depends on it. `api/send-export.ts` backs
  "Email selected records" on the register page: pick records, type any
  recipient address, and a link to a zip of them (spreadsheet + PDFs,
  uploaded to the `sds-pdfs` bucket under `exports/`) gets emailed there.
  Needs only `RESEND_API_KEY`. Both the recipient address and the export
  URL are validated server-side (`shared/email.ts`,
  `api/_lib/export-link.ts`) — the URL check pins it to this project's own
  storage path, since an unauthenticated public endpoint that could email
  an arbitrary link to an arbitrary address would be an open spam relay.
- **SDS Record ID (`SDS-042`):** server-assigned, not computed in app code.
  A Postgres sequence + trigger (`supabase/migrations/0005_sds_number_scheme.sql`)
  stamps it on insert, ignoring whatever the client sends, and a second
  trigger locks both `record_id` and `filename_stem` against change on
  update — editing a record's fields must never reassign its number or
  rename its already-distributed PDF/link. `filename_stem` (e.g.
  "Aquanamel") is a human-confirmed contraction of the product name, entered
  on the review screen (pre-filled by `buildFilenameStem`,
  `shared/sds-id.ts`) before first save, then immutable. `is_superseded` /
  `supersedes_id` exist for a future "re-issued SDS" flow — no UI reads or
  writes them yet.
- **Export (SharePoint-ready):** every XLSX export (`src/lib/export-register.ts`)
  has two sheets. `Paste` is machine-clean and paste-ready for a SharePoint
  list's grid view — one header row, sanitised plain-text cells, no
  formatting/merges/hyperlinks/frozen panes. `Read Me` carries the
  disclaimer and column/section documentation instead. `SDS Filename`
  (`shared/sds-id.ts`'s `sdsFilename`) is `filename_stem` plus the number
  parsed back out of `record_id` (e.g. "Aquanamel-042") — never stored or
  computed a second time, so it can't disagree with SDS Record ID. `SDS
  Link` is `VITE_SHAREPOINT_LIBRARY_URL` (optional; blank column if unset)
  plus that filename plus `.pdf`. Extraction Status and Review Reasons are
  register-only (shown on the review screen), not exported. The batch-zip
  download (`src/lib/download-batch.ts`) validates the batch before zipping
  (empty record IDs, empty filenames, missing PDFs, SharePoint-illegal
  filename characters) and bundles PDFs under a `pdfs/` folder, each named
  `<SDS Filename>.pdf`.

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

No user accounts. Anyone with the URL can read the register, insert reviewed
records, and edit/delete existing ones (RLS allows anon select+insert+update
+delete; migration 0003 added update/delete and the storage-object delete).
`reviewed_by` is typed initials. Revisit (add auth) if the register becomes
sensitive or the URL is widely shared.

## Environment variables

See `.env.example` — it documents every variable and where it's used.
Local: copy to `.env.local`. Production: set in Vercel project settings.

## Build phases (stop after each for user review)

1. ✅ Scaffold + CLAUDE.md + Supabase schema + hello-world deploy
2. ✅ Upload → extract (`/api/extract`) → review screen → save
3. ✅ Register list view + CSV/XLSX export, with edit/delete in place
4. ❌ Removed: a guided-web-search-and-paste-link page (`/find`) and a
   barcode-scan-to-product-lookup page (`/scan`), plus all backing code
   (`api/fetch-pdf.ts`, `api/barcode.ts`, `api/barcode-mapping.ts`,
   `api/_lib/barcode/`, `shared/sds-url.ts`, `shared/barcode.ts`) were built
   and later removed at the user's request — the app should not search for
   or locate an SDS on the worker's behalf, only read one they supply. The
   now-unused `barcode_mappings` table (migration 0004) is left in place,
   retired, per the same convention as `sds_records`.
5. ✅ Polish, tests, docs
