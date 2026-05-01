-- =====================================================================
-- Passionate Teaching · 0001 init
-- Schema: profiles, courses, modules, lessons, enrollments, progress,
--         assignments, submissions, quizzes, announcements, messaging.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------- enums --------------------------------------------------
do $$ begin
  create type public.user_role as enum ('student', 'tutor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lesson_type as enum ('video', 'text', 'pdf');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  role         public.user_role not null default 'student',
  avatar_url   text,
  bio          text,
  low_bandwidth boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

-- ---------- courses -----------------------------------------------
create table if not exists public.courses (
  id           uuid primary key default uuid_generate_v4(),
  tutor_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  description  text,
  cover_url    text,
  published    boolean not null default false,
  is_premium   boolean not null default false,
  price_gbp    numeric(8,2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists courses_tutor_idx on public.courses(tutor_id);
create index if not exists courses_published_idx on public.courses(published);

-- ---------- modules -----------------------------------------------
create table if not exists public.modules (
  id           uuid primary key default uuid_generate_v4(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  title        text not null,
  position     int not null default 0,
  is_locked    boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists modules_course_idx on public.modules(course_id, position);

-- ---------- lessons -----------------------------------------------
create table if not exists public.lessons (
  id           uuid primary key default uuid_generate_v4(),
  module_id    uuid not null references public.modules(id) on delete cascade,
  title        text not null,
  type         public.lesson_type not null,
  content_url  text,
  body         text,           -- for text-type lessons (or fallback transcript)
  duration_sec int,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists lessons_module_idx on public.lessons(module_id, position);

-- ---------- enrollments -------------------------------------------
create table if not exists public.enrollments (
  id           uuid primary key default uuid_generate_v4(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  enrolled_at  timestamptz not null default now(),
  unique (course_id, student_id)
);

create index if not exists enrollments_student_idx on public.enrollments(student_id);
create index if not exists enrollments_course_idx on public.enrollments(course_id);

-- ---------- lesson_progress ---------------------------------------
create table if not exists public.lesson_progress (
  id            uuid primary key default uuid_generate_v4(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);

create index if not exists progress_enrollment_idx on public.lesson_progress(enrollment_id);

-- ---------- assignments + submissions -----------------------------
create table if not exists public.assignments (
  id           uuid primary key default uuid_generate_v4(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  title        text not null,
  instructions text,
  due_at       timestamptz,
  max_score    int not null default 100,
  created_at   timestamptz not null default now()
);

create index if not exists assignments_course_idx on public.assignments(course_id);

create table if not exists public.submissions (
  id              uuid primary key default uuid_generate_v4(),
  assignment_id   uuid not null references public.assignments(id) on delete cascade,
  student_id      uuid not null references public.profiles(id) on delete cascade,
  file_url        text,
  text_response   text,
  submitted_at    timestamptz not null default now(),
  grade           int,
  feedback        text,
  graded_at       timestamptz,
  graded_by       uuid references public.profiles(id),
  unique (assignment_id, student_id)
);

create index if not exists submissions_assignment_idx on public.submissions(assignment_id);
create index if not exists submissions_student_idx on public.submissions(student_id);

-- ---------- quizzes -----------------------------------------------
create table if not exists public.quizzes (
  id            uuid primary key default uuid_generate_v4(),
  course_id     uuid not null references public.courses(id) on delete cascade,
  title         text not null,
  instructions  text,
  created_at    timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id            uuid primary key default uuid_generate_v4(),
  quiz_id       uuid not null references public.quizzes(id) on delete cascade,
  prompt        text not null,
  options       jsonb not null,        -- array of {label} objects
  correct_index int not null,
  position      int not null default 0
);

create table if not exists public.quiz_attempts (
  id                    uuid primary key default uuid_generate_v4(),
  quiz_id               uuid not null references public.quizzes(id) on delete cascade,
  student_id            uuid not null references public.profiles(id) on delete cascade,
  score                 int not null default 0,
  total                 int not null default 0,
  qualitative_feedback  text,
  submitted_at          timestamptz not null default now()
);

create table if not exists public.quiz_answers (
  id            uuid primary key default uuid_generate_v4(),
  attempt_id    uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id   uuid not null references public.quiz_questions(id) on delete cascade,
  chosen_index  int not null,
  is_correct    boolean not null
);

-- ---------- announcements -----------------------------------------
create table if not exists public.announcements (
  id           uuid primary key default uuid_generate_v4(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  author_id    uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists announcements_course_idx on public.announcements(course_id, created_at desc);

-- ---------- messaging ---------------------------------------------
create table if not exists public.threads (
  id              uuid primary key default uuid_generate_v4(),
  student_id      uuid not null references public.profiles(id) on delete cascade,
  tutor_id        uuid not null references public.profiles(id) on delete cascade,
  course_id       uuid references public.courses(id) on delete set null,
  last_message_at timestamptz not null default now(),
  unique (student_id, tutor_id, course_id)
);

create table if not exists public.messages (
  id          uuid primary key default uuid_generate_v4(),
  thread_id   uuid not null references public.threads(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create index if not exists messages_thread_idx on public.messages(thread_id, created_at);

-- ---------- audit_log (admin) -------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- helper: progress_pct ----------------------------------
create or replace function public.course_progress_pct(p_enrollment_id uuid)
returns int language sql stable as $$
  select case
    when total = 0 then 0
    else round(100.0 * done / total)::int
  end
  from (
    select
      (select count(*) from public.lessons l
        join public.modules m on m.id = l.module_id
        join public.enrollments e on e.course_id = m.course_id
        where e.id = p_enrollment_id) as total,
      (select count(*) from public.lesson_progress lp
        where lp.enrollment_id = p_enrollment_id) as done
  ) s
$$;

-- ---------- updated_at trigger ------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_courses_updated on public.courses;
create trigger trg_courses_updated before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------- profile auto-create on auth.users insert --------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
