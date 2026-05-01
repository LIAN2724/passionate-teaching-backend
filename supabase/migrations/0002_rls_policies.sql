-- =====================================================================
-- Passionate Teaching · 0002 RLS policies
-- Principle: Students see their own data. Tutors see data for courses
--            they own. Admins see everything.
-- =====================================================================

-- helper: is current user an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- helper: is current user the tutor of a given course?
create or replace function public.is_course_tutor(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.courses
    where id = p_course_id and tutor_id = auth.uid()
  );
$$;

-- helper: is current user enrolled in a given course?
create or replace function public.is_enrolled(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments
    where course_id = p_course_id and student_id = auth.uid()
  );
$$;

-- ---------- enable RLS on every table -----------------------------
alter table public.profiles         enable row level security;
alter table public.courses          enable row level security;
alter table public.modules          enable row level security;
alter table public.lessons          enable row level security;
alter table public.enrollments      enable row level security;
alter table public.lesson_progress  enable row level security;
alter table public.assignments      enable row level security;
alter table public.submissions      enable row level security;
alter table public.quizzes          enable row level security;
alter table public.quiz_questions   enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.quiz_answers     enable row level security;
alter table public.announcements    enable row level security;
alter table public.threads          enable row level security;
alter table public.messages         enable row level security;
alter table public.audit_log        enable row level security;

-- ---------- profiles ----------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.enrollments e
      join public.courses c on c.id = e.course_id
      where (e.student_id = auth.uid() and c.tutor_id = profiles.id)
         or (c.tutor_id = auth.uid() and e.student_id = profiles.id)
    )
  );

drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete using (public.is_admin());

-- ---------- courses -----------------------------------------------
drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses
  for select using (
    published = true
    or tutor_id = auth.uid()
    or public.is_admin()
    or public.is_enrolled(id)
  );

drop policy if exists courses_tutor_write on public.courses;
create policy courses_tutor_write on public.courses
  for all using (tutor_id = auth.uid() or public.is_admin())
  with check (tutor_id = auth.uid() or public.is_admin());

-- ---------- modules + lessons (visible if course visible) ---------
drop policy if exists modules_read on public.modules;
create policy modules_read on public.modules
  for select using (
    public.is_course_tutor(course_id)
    or public.is_enrolled(course_id)
    or public.is_admin()
    or exists (select 1 from public.courses c where c.id = modules.course_id and c.published)
  );

drop policy if exists modules_tutor_write on public.modules;
create policy modules_tutor_write on public.modules
  for all using (public.is_course_tutor(course_id) or public.is_admin())
  with check (public.is_course_tutor(course_id) or public.is_admin());

drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons
  for select using (
    exists (
      select 1 from public.modules m
      where m.id = lessons.module_id and (
        public.is_course_tutor(m.course_id)
        or public.is_enrolled(m.course_id)
        or public.is_admin()
      )
    )
  );

drop policy if exists lessons_tutor_write on public.lessons;
create policy lessons_tutor_write on public.lessons
  for all using (
    exists (
      select 1 from public.modules m
      where m.id = lessons.module_id and (public.is_course_tutor(m.course_id) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.modules m
      where m.id = lessons.module_id and (public.is_course_tutor(m.course_id) or public.is_admin())
    )
  );

-- ---------- enrollments + progress --------------------------------
drop policy if exists enrollments_read on public.enrollments;
create policy enrollments_read on public.enrollments
  for select using (
    student_id = auth.uid()
    or public.is_course_tutor(course_id)
    or public.is_admin()
  );

drop policy if exists enrollments_student_insert on public.enrollments;
create policy enrollments_student_insert on public.enrollments
  for insert with check (student_id = auth.uid());

drop policy if exists enrollments_self_delete on public.enrollments;
create policy enrollments_self_delete on public.enrollments
  for delete using (student_id = auth.uid() or public.is_admin());

drop policy if exists progress_read on public.lesson_progress;
create policy progress_read on public.lesson_progress
  for select using (
    exists (
      select 1 from public.enrollments e
      where e.id = lesson_progress.enrollment_id and (
        e.student_id = auth.uid()
        or public.is_course_tutor(e.course_id)
        or public.is_admin()
      )
    )
  );

drop policy if exists progress_student_write on public.lesson_progress;
create policy progress_student_write on public.lesson_progress
  for insert with check (
    exists (
      select 1 from public.enrollments e
      where e.id = lesson_progress.enrollment_id and e.student_id = auth.uid()
    )
  );

drop policy if exists progress_student_delete on public.lesson_progress;
create policy progress_student_delete on public.lesson_progress
  for delete using (
    exists (
      select 1 from public.enrollments e
      where e.id = lesson_progress.enrollment_id and (e.student_id = auth.uid() or public.is_admin())
    )
  );

-- ---------- assignments + submissions -----------------------------
drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments
  for select using (
    public.is_course_tutor(course_id)
    or public.is_enrolled(course_id)
    or public.is_admin()
  );

drop policy if exists assignments_tutor_write on public.assignments;
create policy assignments_tutor_write on public.assignments
  for all using (public.is_course_tutor(course_id) or public.is_admin())
  with check (public.is_course_tutor(course_id) or public.is_admin());

drop policy if exists submissions_read on public.submissions;
create policy submissions_read on public.submissions
  for select using (
    student_id = auth.uid()
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and public.is_course_tutor(a.course_id)
    )
    or public.is_admin()
  );

drop policy if exists submissions_student_insert on public.submissions;
create policy submissions_student_insert on public.submissions
  for insert with check (student_id = auth.uid());

drop policy if exists submissions_student_update on public.submissions;
create policy submissions_student_update on public.submissions
  for update using (
    -- student can update their own submission until graded
    (student_id = auth.uid() and grade is null)
    or exists (
      select 1 from public.assignments a
      where a.id = submissions.assignment_id and public.is_course_tutor(a.course_id)
    )
    or public.is_admin()
  );

-- ---------- quizzes + attempts ------------------------------------
drop policy if exists quizzes_read on public.quizzes;
create policy quizzes_read on public.quizzes
  for select using (
    public.is_course_tutor(course_id)
    or public.is_enrolled(course_id)
    or public.is_admin()
  );

drop policy if exists quizzes_tutor_write on public.quizzes;
create policy quizzes_tutor_write on public.quizzes
  for all using (public.is_course_tutor(course_id) or public.is_admin())
  with check (public.is_course_tutor(course_id) or public.is_admin());

drop policy if exists quiz_questions_read on public.quiz_questions;
create policy quiz_questions_read on public.quiz_questions
  for select using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id and (
        public.is_course_tutor(q.course_id)
        or public.is_enrolled(q.course_id)
        or public.is_admin()
      )
    )
  );

drop policy if exists quiz_questions_tutor_write on public.quiz_questions;
create policy quiz_questions_tutor_write on public.quiz_questions
  for all using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id and (public.is_course_tutor(q.course_id) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id and (public.is_course_tutor(q.course_id) or public.is_admin())
    )
  );

drop policy if exists quiz_attempts_read on public.quiz_attempts;
create policy quiz_attempts_read on public.quiz_attempts
  for select using (
    student_id = auth.uid()
    or exists (
      select 1 from public.quizzes q
      where q.id = quiz_attempts.quiz_id and public.is_course_tutor(q.course_id)
    )
    or public.is_admin()
  );

drop policy if exists quiz_attempts_student_insert on public.quiz_attempts;
create policy quiz_attempts_student_insert on public.quiz_attempts
  for insert with check (student_id = auth.uid());

drop policy if exists quiz_answers_rw on public.quiz_answers;
create policy quiz_answers_rw on public.quiz_answers
  for all using (
    exists (
      select 1 from public.quiz_attempts qa
      where qa.id = quiz_answers.attempt_id and (
        qa.student_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.quizzes q
          where q.id = qa.quiz_id and public.is_course_tutor(q.course_id)
        )
      )
    )
  )
  with check (
    exists (
      select 1 from public.quiz_attempts qa
      where qa.id = quiz_answers.attempt_id and qa.student_id = auth.uid()
    )
  );

-- ---------- announcements -----------------------------------------
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements
  for select using (
    public.is_course_tutor(course_id)
    or public.is_enrolled(course_id)
    or public.is_admin()
  );

drop policy if exists announcements_tutor_write on public.announcements;
create policy announcements_tutor_write on public.announcements
  for all using (public.is_course_tutor(course_id) or public.is_admin())
  with check (public.is_course_tutor(course_id) or public.is_admin());

-- ---------- messaging ---------------------------------------------
drop policy if exists threads_read on public.threads;
create policy threads_read on public.threads
  for select using (
    student_id = auth.uid() or tutor_id = auth.uid() or public.is_admin()
  );

drop policy if exists threads_participant_write on public.threads;
create policy threads_participant_write on public.threads
  for all using (student_id = auth.uid() or tutor_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or tutor_id = auth.uid() or public.is_admin());

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select using (
    exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.student_id = auth.uid() or t.tutor_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists messages_sender_insert on public.messages;
create policy messages_sender_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.student_id = auth.uid() or t.tutor_id = auth.uid())
    )
  );

drop policy if exists messages_sender_update on public.messages;
create policy messages_sender_update on public.messages
  for update using (
    sender_id = auth.uid()
    or exists (
      select 1 from public.threads t
      where t.id = messages.thread_id
        and (t.student_id = auth.uid() or t.tutor_id = auth.uid())
    )
  );

-- ---------- audit_log: admin only ---------------------------------
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select using (public.is_admin());

drop policy if exists audit_system_insert on public.audit_log;
create policy audit_system_insert on public.audit_log
  for insert with check (true);  -- inserted by triggers / service-role only
