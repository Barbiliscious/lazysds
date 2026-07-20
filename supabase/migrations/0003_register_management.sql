-- LazySDS schema, migration 0003.
-- Allow the register to be managed (edited + deleted) from within the app.
--
-- Access model (deliberate, see CLAUDE.md): still no user accounts. Anyone
-- with the app URL can now UPDATE and DELETE register rows and their stored
-- PDFs, at the same trust level as the existing anon INSERT. Revisit (add
-- auth) if the register ever becomes sensitive or the URL is widely shared.

grant update, delete on table public.sds_index to anon;

create policy "anon can update index"
  on public.sds_index for update to anon using (true) with check (true);

create policy "anon can delete index"
  on public.sds_index for delete to anon using (true);

-- Let the app remove a record's stored PDF when the record is deleted.
create policy "anon can delete sds pdfs"
  on storage.objects for delete to anon
  using (bucket_id = 'sds-pdfs');
