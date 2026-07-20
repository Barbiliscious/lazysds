-- LazySDS schema, migration 0004.
-- A small internal barcode -> product mapping table. Once a worker confirms
-- what a barcode is, later scans of the same barcode are answered instantly
-- from this table without calling any external provider or the AI web-search
-- fallback again. Keyed by the already-normalized barcode (see shared/barcode.ts).
--
-- Access model: same as the rest of the app (see CLAUDE.md) - no accounts,
-- anyone with the URL can add or correct a mapping. No delete: a bad mapping
-- is corrected by confirming a new value for the same barcode (upsert), not
-- removed via the UI.

create table public.barcode_mappings (
  barcode text primary key,
  product_name text not null,
  brand text,
  manufacturer_product_code text,
  size text,
  variant text,
  source_url text,
  source_provider text,          -- which path first identified it, e.g. 'web_search', 'eandata'
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.barcode_mappings enable row level security;

revoke all privileges on table public.barcode_mappings from anon;
grant select, insert, update on table public.barcode_mappings to anon;

create policy "anon can read barcode mappings"
  on public.barcode_mappings for select to anon using (true);

create policy "anon can insert barcode mappings"
  on public.barcode_mappings for insert to anon with check (true);

create policy "anon can update barcode mappings"
  on public.barcode_mappings for update to anon using (true) with check (true);
