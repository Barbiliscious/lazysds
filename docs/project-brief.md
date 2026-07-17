# LazySDS Project Brief

Updated: 17 July 2026

## Purpose

LazySDS helps an office worker identify an everyday product, find its Safety
Data Sheet (SDS), check AI-extracted information against the real document and
save an approved quick-reference register row.

## Current release state

- Working branch: `main-hxpggl`
- Stable testing URL:
  `https://lazysds-git-main-hxpggl-mullaneaa-7828s-projects.vercel.app`
- Production: intentionally unchanged until Preview testing passes
- Database: hosted Supabase `lazysds`; migrations `0001` and `0002` are the
  schema source of truth; new records use `public.sds_index`
- No new database migration is required for barcode lookup
- UPC Database fallback code is deployed, but UPC Database currently rejects
  the token created on 16 July 2026 as invalid. Open Facts and the normal web
  fallback continue to work. Do not create or replace a token without Aaron's
  confirmation.

## Completed user flows

1. Upload an SDS PDF, extract its page-tagged text and send it to Sonnet 5.
2. Review the full PDF pages beside the fields derived from those pages.
3. Check exact source quotations and section/page locations for each field.
4. Confirm controlled pictograms and one resolved Review Date.
5. Save only after a person verifies the record with their initials.
6. View the register and export the exact 20-column CSV or styled Excel file.
7. Scan or type a barcode, identify the product and continue to SDS search.

## Barcode lookup order

1. Open Products Facts
2. Open Food Facts
3. Open Beauty Facts
4. UPC Database, only when `UPC_DATABASE_API_KEY` is configured server-side
5. Normal web search when every database misses

Keeping the free Open Facts services first preserves the limited UPC Database
daily allowance. The UPC token must never use a `VITE_` prefix or be sent to
the browser.

## Register rules

- Excel and CSV exports contain exactly 20 columns.
- Manufacturer, Supplier and Importer share one field; the first organisation
  present in the SDS is used.
- Pictograms use fixed GHS wording and are confirmed by the reviewer.
- Review Date is one resolved value, marked as either from the SDS or
  calculated from Issue Date.
- AI source quotations preserve the SDS punctuation exactly.
- Dilution / Use Condition is stored and reviewed but remains outside the
  initial 20-column export.

## Important limitations

- Barcode databases identify products; they do not supply an SDS.
- Product coverage is incomplete, so manual web search remains deliberate.
- There are no user accounts. Anonymous users can read and insert reviewed
  records; corrections and deletions happen in Supabase.
- Production must not be promoted until a genuine SDS passes the complete
  scan/upload -> extraction -> approval -> save -> export test.

## Required checks before production

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. Verify the Preview deployment is Ready.
5. Test a known barcode and a barcode that needs the UPC Database fallback.
6. Complete one genuine SDS end to end and inspect the downloaded Excel file.
7. Confirm the saved row appears in the register before promoting Preview.

## Preview verification - 17 July 2026

- Deployment status: Ready
- `/scan`: HTTP 200 and rendered correctly
- `/api/health`: HTTP 200
- Known barcode `3017620422003`: identified as Nutella through Open Facts
- Invalid barcode: rejected with HTTP 400 and plain-language guidance
- Browser console: no LazySDS errors
- UPC-only test barcode: reached the fallback but returned no product
- Direct UPC `/product` and `/account` checks: provider reported the current
  token as invalid
- Production: not promoted and unchanged

## Key files

- Extraction contract: `api/_lib/extraction/`
- Barcode orchestration and adapters: `api/_lib/barcode/`
- Export columns: `shared/config/register-columns.ts`
- Review layout: `src/pages/ReviewPage.tsx` and
  `src/components/PdfReviewPages.tsx`
- Database migrations: `supabase/migrations/`
- Environment variable template: `.env.example`
