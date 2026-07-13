-- LazySDS schema, migration 0001.
-- Source of truth for the database. Applied to the hosted project via the
-- Supabase integration; kept here so the schema is reviewable in git and
-- reproducible on a fresh project.

create table public.sds_records (
  id uuid primary key default gen_random_uuid(),

  -- Fields extracted from the SDS. Stored verbatim from the document;
  -- null means "not clearly stated", never "unknown but probably X".
  product_name text,
  manufacturer text,
  supplier text,
  is_hazardous boolean,
  dangerous_goods_class text,
  un_number text,
  issue_date text, -- text on purpose: SDS date formats vary too much to parse reliably
  hazard_statements text[] not null default '{}',
  confidence jsonb not null default '{}'::jsonb,

  -- Provenance
  pdf_url text,
  source text not null check (source in ('upload', 'pubchem', 'web_search')),
  reviewed_by text not null,
  created_at timestamptz not null default now()
);

alter table public.sds_records enable row level security;

-- Access model (deliberate, see CLAUDE.md): no user accounts. Anyone with
-- the app URL can read the register and add reviewed records. Nothing can
-- be updated or deleted from the browser — corrections happen in the
-- Supabase dashboard until auth is added.
create policy "anon can read records"
  on public.sds_records for select to anon using (true);

create policy "anon can insert records"
  on public.sds_records for insert to anon with check (true);

-- Public bucket for the SDS PDFs so the register can link straight to them.
insert into storage.buckets (id, name, public)
values ('sds-pdfs', 'sds-pdfs', true);

create policy "anon can upload sds pdfs"
  on storage.objects for insert to anon
  with check (bucket_id = 'sds-pdfs');

create policy "public can read sds pdfs"
  on storage.objects for select
  using (bucket_id = 'sds-pdfs');
