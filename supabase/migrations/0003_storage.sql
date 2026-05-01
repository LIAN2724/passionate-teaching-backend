-- =====================================================================
-- Passionate Teaching · 0003 storage buckets + policies
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('course-content', 'course-content', false),
  ('submissions',    'submissions',    false),
  ('avatars',        'avatars',        true)
on conflict (id) do nothing;

-- ---------- avatars (public read, owner write) --------------------
drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users update their own avatar" on storage.objects;
create policy "users update their own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------- course-content (tutor write, enrolled-or-tutor read) --
-- We expect path layout: <course_id>/<lesson_uuid>.<ext>
drop policy if exists "course content readable by participants" on storage.objects;
create policy "course content readable by participants" on storage.objects
  for select using (
    bucket_id = 'course-content'
    and (
      public.is_admin()
      or exists (
        select 1 from public.courses c
        where c.id::text = (storage.foldername(name))[1]
          and (c.tutor_id = auth.uid() or public.is_enrolled(c.id))
      )
    )
  );

drop policy if exists "course content writable by owning tutor" on storage.objects;
create policy "course content writable by owning tutor" on storage.objects
  for insert with check (
    bucket_id = 'course-content'
    and (
      public.is_admin()
      or exists (
        select 1 from public.courses c
        where c.id::text = (storage.foldername(name))[1]
          and c.tutor_id = auth.uid()
      )
    )
  );

drop policy if exists "course content updatable by owning tutor" on storage.objects;
create policy "course content updatable by owning tutor" on storage.objects
  for update using (
    bucket_id = 'course-content'
    and (
      public.is_admin()
      or exists (
        select 1 from public.courses c
        where c.id::text = (storage.foldername(name))[1]
          and c.tutor_id = auth.uid()
      )
    )
  );

drop policy if exists "course content deletable by owning tutor" on storage.objects;
create policy "course content deletable by owning tutor" on storage.objects
  for delete using (
    bucket_id = 'course-content'
    and (
      public.is_admin()
      or exists (
        select 1 from public.courses c
        where c.id::text = (storage.foldername(name))[1]
          and c.tutor_id = auth.uid()
      )
    )
  );

-- ---------- submissions (student write own, tutor read course's) --
-- Expected path layout: <course_id>/<student_id>/<assignment_id>.<ext>
drop policy if exists "submissions readable by student or course tutor" on storage.objects;
create policy "submissions readable by student or course tutor" on storage.objects
  for select using (
    bucket_id = 'submissions'
    and (
      public.is_admin()
      or auth.uid()::text = (storage.foldername(name))[2]
      or exists (
        select 1 from public.courses c
        where c.id::text = (storage.foldername(name))[1]
          and c.tutor_id = auth.uid()
      )
    )
  );

drop policy if exists "submissions writable by student" on storage.objects;
create policy "submissions writable by student" on storage.objects
  for insert with check (
    bucket_id = 'submissions'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

drop policy if exists "submissions updatable by student" on storage.objects;
create policy "submissions updatable by student" on storage.objects
  for update using (
    bucket_id = 'submissions'
    and auth.uid()::text = (storage.foldername(name))[2]
  );
