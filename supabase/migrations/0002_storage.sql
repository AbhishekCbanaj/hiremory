-- Resume storage. Create a PRIVATE bucket named 'resumes' in the dashboard
-- (Storage -> New bucket -> uncheck "Public"), then run this.
-- Each user can only touch files under a folder named after their own uid:
--   resumes/<auth.uid()>/<filename>.pdf
-- Upsert needs INSERT + SELECT + UPDATE; we add DELETE so users can remove files.

create policy "resumes: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'resumes'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'resumes'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "resumes: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
