-- LazySDS schema, migration 0002.
-- New quick-reference index table: one row per SDS, per the Grampians
-- Community Health extraction standard (v1.1). Replaces the flat sds_records
-- shape from 0001 for new work; 0001 is left in place (it is empty).
--
-- The extracted fields (each a { value, status, excerpt, location } object)
-- are stored as jsonb under `extracted`; the date-derived columns are
-- computed in application code, never by the AI.

create table public.sds_index (
  id uuid primary key default gen_random_uuid(),

  record_id text not null,          -- col 1: SUPPLIER-PRODUCT-ISSUEDATE
  pdf_url text not null,            -- col 6: the link to the stored SDS PDF
  extracted jsonb not null,        -- the 24 fields-with-evidence + verdict

  review_date text,                -- col 8: stated review-by date, or Issue + 5y
  review_date_calculated boolean not null default false,
  currency_flag text not null,     -- col 9: CURRENT / POSSIBLY_OUTDATED / DATE_UNCONFIRMED

  source text not null check (source in ('upload', 'pubchem', 'web_search')),

  -- col 31/32: set at the moment a human confirms on the approval screen.
  verified_by text not null,
  verified_at timestamptz not null,

  created_at timestamptz not null default now()
);

alter table public.sds_index enable row level security;

-- Supabase projects created after April 2026 do not expose new public tables
-- automatically. Grant only the two operations this no-account app needs;
-- RLS policies below still decide which rows those operations can access.
revoke all privileges on table public.sds_index from anon;
grant select, insert on table public.sds_index to anon;

-- Same deliberate access model as sds_records (see CLAUDE.md): no accounts.
-- Anyone with the URL can read the register and add reviewed rows; nothing
-- can be updated or deleted from the browser — corrections happen in the
-- Supabase dashboard.
create policy "anon can read index"
  on public.sds_index for select to anon using (true);

create policy "anon can insert index"
  on public.sds_index for insert to anon with check (true);
