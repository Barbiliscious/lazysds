-- LazySDS schema, migration 0005.
-- SDS-NNN numbering scheme + SharePoint-ready SDS Filename, per the export
-- spec (2026-08-06). record_id changes from a content-derived slug to a
-- server-assigned ascending id (SDS-001, SDS-002, ...): it must be assigned
-- exactly once and never change afterwards, since it names the exported PDF
-- and feeds an already-distributed SharePoint link. Both invariants are
-- enforced here, not just in application code, since this table has no
-- accounts and allows anonymous insert/update (see CLAUDE.md).
--
-- filename_stem is the human/AI-chosen contraction of the product name
-- (e.g. "Aquanamel") WITHOUT the trailing "-042" number - the number always
-- comes from record_id, so the two can never disagree. The full "SDS
-- Filename" shown in exports (e.g. "Aquanamel-042") is filename_stem plus
-- the number parsed back out of record_id, computed in application code
-- (shared/sds-id.ts), not stored twice.
--
-- The existing register was wiped (by agreement with the register owner)
-- immediately before this migration, so there is no legacy record_id format
-- to reconcile here.

create sequence public.sds_record_seq start with 1;

alter table public.sds_index
  add column filename_stem text not null,
  add column is_superseded boolean not null default false,
  add column supersedes_id uuid references public.sds_index(id) on delete set null;

alter table public.sds_index
  add constraint sds_index_record_id_unique unique (record_id);

-- Ignores whatever record_id the client sends (if anything) - the sequence
-- is the only source of the number, so it can't collide or be reused even
-- under concurrent anonymous inserts.
create or replace function public.assign_sds_record_id()
returns trigger as $$
begin
  new.record_id := 'SDS-' || lpad(nextval('public.sds_record_seq')::text, 3, '0');
  return new;
end;
$$ language plpgsql;

create trigger sds_index_assign_record_id
  before insert on public.sds_index
  for each row execute function public.assign_sds_record_id();

-- Once assigned at insert, record_id and filename_stem never change -
-- editing a record's extracted fields must not reassign its number or
-- rename its already-distributed PDF/link.
create or replace function public.lock_sds_identity()
returns trigger as $$
begin
  new.record_id := old.record_id;
  new.filename_stem := old.filename_stem;
  return new;
end;
$$ language plpgsql;

create trigger sds_index_lock_identity
  before update on public.sds_index
  for each row execute function public.lock_sds_identity();
