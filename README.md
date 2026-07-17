# LazySDS

Find the Safety Data Sheet for a product, extract the compliance-relevant
fields with AI, review them as a human, and keep them in a register you can
export to CSV/XLSX.

## Local setup

1. **Install:** `npm install` (Node 20+)
2. **Env vars:** copy `.env.example` to `.env.local` and fill in the values.
   The Supabase URL and anon key come from the Supabase dashboard
   (Project Settings → API). Server-side keys (Anthropic etc.) are only
   needed when running the full stack.
3. **Run:**
   - `npm run dev` — frontend only, fastest loop for UI work. `/api` routes
     are not served, so extraction/search won't work.
   - `vercel dev` — full stack (requires the [Vercel CLI](https://vercel.com/docs/cli)
     and a linked project). Serves the Vite app *and* the `api/` functions.

## How it works

- **Have the PDF?** Home page → upload it → the AI reads it → you check the
  fields against the document → it's saved to the register.
- **Don't have the PDF?** `/find` → type the product name → the app opens a
  web search in a new tab → paste the PDF's link back in and the server
  fetches it (from trusted sites only — see `shared/config/sds-domains.ts`),
  then the same review-and-save flow runs. Built deliberately without a
  search API; a keyed search adapter can replace the copy-paste hop later.
- **Only have the product in hand?** `/scan` → point the camera at the
  barcode (or type the digits printed under it) → the free Open Products /
  Food / Beauty Facts databases are checked first → UPC Database is checked
  only when they miss → straight into the find flow. If every database
  misses, the fallback is a web search for the barcode number.
- **The register** (`/register`) lists everything saved and exports to
  CSV or Excel.

## Tests

`npm test` runs the Vitest suite. Tests live next to the code they cover
(`*.test.ts`): barcode providers and fallback order, the extraction schema,
the export formatting/CSV escaping and the trusted-URL checks.

## Deployment (Vercel)

1. Push to the linked git repo, or run `vercel --prod`.
2. Set environment variables in Vercel → Project → Settings → Environment
   Variables. Every variable is documented in `.env.example`. `VITE_`-prefixed
   vars must be present at **build** time.
3. The database schema lives in `supabase/migrations/`. It has already been
   applied to the hosted `lazysds` Supabase project; for a fresh project, run
   the migrations in order in the Supabase SQL editor.

## Where to change things

- Export columns/headers: `shared/config/register-columns.ts`
- Trusted SDS search domains: `shared/config/sds-domains.ts`
- Extraction prompt/schema: `api/_lib/extraction/`
- Barcode lookup order/adapters: `api/_lib/barcode/`

## Current handoff

The testing branch is `main-hxpggl`. Its stable Preview URL is:

`https://lazysds-git-main-hxpggl-mullaneaa-7828s-projects.vercel.app`

Production is deliberately kept separate until a genuine SDS completes the
full scan/upload → extraction → approval → save → export test. See
`docs/project-brief.md` for the current state and test checklist.

More conventions and architecture notes: see `CLAUDE.md`.
