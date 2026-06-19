-- QA fix: 0002 assumed the 'resumes' bucket was created by hand in the dashboard.
-- If it wasn't, resume upload (compose) and the worker's resume download both fail
-- with "Bucket not found". Create it here so setup is self-contained. Idempotent.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;
