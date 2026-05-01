# Passionate Teaching — Backend (Supabase)

Database schema, Row-Level Security policies, and seed data for the Passionate Teaching Learning Management System.

## Project

- **Provider:** Supabase (Postgres)
- **Project ref:** `wlqkrtdquksaomuuwswy`
- **Region:** London (`eu-west-2`)

## Layout

```
supabase/
├─ migrations/
│  ├─ 0001_init.sql           tables, enums, functions, indexes
│  └─ 0002_rls_policies.sql   row-level security
└─ seed.sql                   demo accounts + courses + lessons + assignments
```

## Schema (high-level)

```
profiles           one row per auth.users — full_name, role, avatar
courses            tutor-owned containers of modules
modules            ordered groups of lessons inside a course
lessons            video / pdf / text content units
enrollments        student-course join + enrolled_at
lesson_progress    per-student per-lesson completion flag
assignments        course-scoped tasks with due_at + max_score
submissions        student uploads + tutor grade + tutor feedback
quizzes            course-scoped MCQs
quiz_questions     prompt + options[] + correct_index
quiz_attempts      score + qualitative feedback
quiz_answers       per-question chosen answer
announcements      course-scoped tutor broadcasts
threads            student-tutor message channel
messages           individual messages within a thread
audit_log          admin trail
```

Storage buckets:

- `course-content` — video, PDF, text-lesson assets (private, signed URLs)
- `submissions` — student assignment uploads (private)
- `avatars` — public profile pictures

## Applying migrations

Three options.

**A. Supabase SQL editor (manual, no install)**

Paste each `migrations/*.sql` file in order into Project → SQL Editor → Run.

**B. Supabase CLI (preferred — keeps history)**

```bash
npm i -g supabase
supabase login    # opens browser
supabase link --project-ref wlqkrtdquksaomuuwswy
supabase db push
```

**C. psql direct (one-off)**

```bash
psql "postgresql://postgres:<password>@db.wlqkrtdquksaomuuwswy.supabase.co:5432/postgres" \
  -f supabase/migrations/0001_init.sql \
  -f supabase/migrations/0002_rls_policies.sql \
  -f supabase/seed.sql
```

## Seed data

`seed.sql` provisions one tutor (`mr.dhiraj@passionate.test`), three students, one admin, two demo courses with 8 lessons total, 2 assignments, 1 quiz, sample announcements, and a couple of message threads. All passwords are `Demo1234!` for testing.
