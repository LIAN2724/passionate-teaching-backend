#!/usr/bin/env node
/**
 * Seed Passionate Teaching with demo data using the service-role key.
 *
 *   node scripts/seed.mjs                # idempotent — safe to re-run
 */

import { readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = await loadEnv(join(HERE, "..", ".env.local"));
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) fail("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");

const sb = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "Demo1234!";
const log = (...a) => console.log("•", ...a);

// ---------------- USERS ----------------
const userDefs = [
  { email: "admin@passionate.test",   role: "admin",   full_name: "Admin User",
    bio: "Platform administrator." },
  { email: "dhiraj@passionate.test",  role: "tutor",   full_name: "Mr. Dhiraj",
    bio: "Independent tutor focused on Mathematics and Computer Science. Founder of Passionate Teaching." },
  { email: "sarah@passionate.test",   role: "student", full_name: "Sarah Kapoor",
    bio: "Year 12 student preparing for A-Levels." },
  { email: "james@passionate.test",   role: "student", full_name: "James O'Connor",
    bio: "Year 11 student aiming for top GCSE grades." },
  { email: "aisha@passionate.test",   role: "student", full_name: "Aisha Rahman",
    bio: "First-year university student topping up CS fundamentals." },
];

const users = {};
for (const u of userDefs) {
  let id = await findUserId(u.email);
  if (!id) {
    const { data, error } = await sb.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
    });
    if (error) fail(`createUser ${u.email}: ${error.message}`);
    id = data.user.id;
    log(`created ${u.email}`);
  } else {
    log(`exists  ${u.email}`);
  }

  // Force profile fields (the trigger-created row may lag)
  const { error: upErr } = await sb.from("profiles").upsert({
    id,
    full_name: u.full_name,
    role: u.role,
    bio: u.bio,
  });
  if (upErr) fail(`profile upsert ${u.email}: ${upErr.message}`);

  users[u.email] = id;
}

const tutor   = users["dhiraj@passionate.test"];
const sarah   = users["sarah@passionate.test"];
const james   = users["james@passionate.test"];
const aisha   = users["aisha@passionate.test"];

// ---------------- COURSES ----------------
const courses = await upsertCourses([
  {
    title: "GCSE Mathematics: Algebra Foundations",
    description:
      "A focused track through linear equations, factorisation, quadratics, and simultaneous equations — designed for students aiming for grade 7+ at GCSE.",
    cover_url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&q=70",
    published: true,
    is_premium: false,
    tutor_id: tutor,
  },
  {
    title: "A-Level Computer Science: Algorithms & Data Structures",
    description:
      "From Big-O notation to graph traversals — the intuitive route through everything an A-Level CS student needs to know about algorithms and data structures.",
    cover_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=70",
    published: true,
    is_premium: true,
    price_gbp: 9.99,
    tutor_id: tutor,
  },
]);

const mathsCourse = courses["GCSE Mathematics: Algebra Foundations"];
const csCourse    = courses["A-Level Computer Science: Algorithms & Data Structures"];

// ---------------- MODULES + LESSONS ----------------
const mathsModules = await upsertModules(mathsCourse, [
  { title: "Linear Equations", position: 0 },
  { title: "Quadratics & Factorisation", position: 1 },
]);

await upsertLessons(mathsModules["Linear Equations"], [
  { title: "Solving One-Step Equations",  type: "video", position: 0,
    duration_sec: 540,
    body: "Build the muscle of isolating x by undoing operations one at a time." },
  { title: "Two-Step and Multi-Step Equations", type: "video", position: 1,
    duration_sec: 720,
    body: "Layered equations: do it in reverse order of operations." },
  { title: "Linear Equations — Worksheet", type: "pdf", position: 2,
    body: "20 mixed practice questions with worked solutions on the last page." },
]);

await upsertLessons(mathsModules["Quadratics & Factorisation"], [
  { title: "Recognising Quadratics", type: "text", position: 0,
    body:
`# Recognising quadratics

A quadratic equation has the form **ax² + bx + c = 0** where a ≠ 0.

Why it matters: quadratics describe projectile motion, area optimisation, and a surprising number of GCSE/A-Level word problems.

## What to look for
- The highest power of the unknown is **2**
- Sometimes hidden: e.g. (x+1)(x+2) = 0 expands to x² + 3x + 2 = 0
- Set everything equal to zero before factorising or applying the formula.

Try a few yourself: which of these are quadratic?
1. 2x² - 5x + 1 = 0  ✓
2. 3x + 4 = 7        ✗ (linear)
3. x(x + 1) = 12     ✓ (rearranges to x² + x - 12 = 0)`,
  },
  { title: "Factorising x² + bx + c", type: "video", position: 1,
    duration_sec: 660,
    body: "Find two numbers that multiply to c and sum to b." },
]);

const csModules = await upsertModules(csCourse, [
  { title: "Algorithmic Foundations", position: 0 },
]);

await upsertLessons(csModules["Algorithmic Foundations"], [
  { title: "Big-O notation in 10 minutes", type: "video", position: 0,
    duration_sec: 600,
    body: "Why we care about how an algorithm scales, not its raw speed." },
  { title: "Linear vs Binary Search",       type: "video", position: 1,
    duration_sec: 540,
    body: "Two lookups, very different performance — see why." },
  { title: "Algorithms reading list",       type: "pdf",   position: 2,
    body: "Curated PDF of further reading on algorithm design." },
]);

// ---------------- ENROLLMENTS ----------------
// Make sure Sarah is *not* in CS — keeps her overall progress at 60% (Figure 7.9).
await sb.from("enrollments").delete().eq("student_id", sarah).eq("course_id", csCourse);

const sarahMaths = await ensureEnrollment(mathsCourse, sarah);
const jamesMaths = await ensureEnrollment(mathsCourse, james);
const aishaCS    = await ensureEnrollment(csCourse,    aisha);

// ---------------- PROGRESS (deterministic) ----------------
// Sarah:  3 of 5 maths lessons done (= 60% — figure 7.9)
// James:  4 of 5 maths lessons done (= 80%)
// Aisha:  3 of 3 CS lessons done    (= 100%)

await markProgress(sarahMaths, mathsCourse, 3);
await markProgress(jamesMaths, mathsCourse, 4);
await markProgress(aishaCS,    csCourse,    3);

// ---------------- ASSIGNMENTS + SUBMISSIONS ----------------
const a1 = await upsertAssignment(mathsCourse,
  "Linear Equations practice set",
  "Complete questions 1–10 from the worksheet PDF. Show working.",
  daysFromNow(7), 100);

const a2 = await upsertAssignment(mathsCourse,
  "Mixed Quadratics homework",
  "Solve each by factorisation. Submit a single PDF.",
  daysFromNow(14), 100);

const a3 = await upsertAssignment(csCourse,
  "Big-O matching exercise",
  "Match each algorithm with its time complexity (worksheet attached).",
  daysFromNow(10), 50);

// James submitted assignment 1, ungraded — upload his actual homework PDF.
const jamesFilePath = await uploadDemoSubmission({
  localFile: "Linear Equations Homework - James OConnor.pdf",
  courseId: mathsCourse,
  studentId: james,
  assignmentId: a1,
  ext: "pdf",
});
await upsertSubmission(a1, james, {
  text_response: "Q1-10 attached as PDF. Confident on Q1-8, less sure on Q9.",
  file_url: jamesFilePath,
});

// Sarah submitted assignment 1, graded
await upsertSubmission(a1, sarah, {
  text_response: "Submitted with working shown for all 10 questions.",
  grade: 88,
  feedback: "Strong work — solid technique throughout. Q9 working was hard to follow; tighten the layout next time.",
  graded_by: tutor,
  graded_at: new Date().toISOString(),
});

// ---------------- QUIZZES ----------------
const quiz1 = await upsertQuiz(mathsCourse,
  "Linear Equations — quick check",
  "3 questions. Instant feedback at the end.");

await upsertQuestions(quiz1, [
  { prompt: "Solve: 2x + 5 = 13",
    options: [{ label: "x = 3" }, { label: "x = 4" }, { label: "x = 9" }, { label: "x = 18" }],
    correct_index: 1 },
  { prompt: "Which is a linear equation?",
    options: [{ label: "y = x²" }, { label: "y = 3x + 2" }, { label: "y = √x" }, { label: "y = 1/x" }],
    correct_index: 1 },
  { prompt: "If 5x − 7 = 18, what is x?",
    options: [{ label: "5" }, { label: "4" }, { label: "3" }, { label: "2" }],
    correct_index: 0 },
]);

// ---------------- ANNOUNCEMENTS ----------------
await upsertAnnouncement(mathsCourse, tutor,
  "Welcome to GCSE Algebra Foundations 👋",
  "Start with Module 1 → Solving One-Step Equations. We'll cover quadratics next week.");

await upsertAnnouncement(mathsCourse, tutor,
  "Worksheet is up",
  "I've added the Linear Equations worksheet to Module 1. Aim to finish it before our next session.");

await upsertAnnouncement(csCourse, tutor,
  "Big-O reading list",
  "Have a look at the PDF before our next session — we'll dig into trade-offs.");

// ---------------- MESSAGES ----------------
const sarahThread = await upsertThread(sarah, tutor, mathsCourse);
await upsertMessages(sarahThread, [
  { sender_id: sarah,
    body: "Hi Mr. Dhiraj — quick question on factorising. For x² + 7x + 10 do I always start by listing factor pairs of 10?",
    minutes_ago: 60 },
  { sender_id: tutor,
    body: "Hi Sarah — yes, factor pairs of c, then pick the pair that sums to b. So 10 → (1,10), (2,5). 2 + 5 = 7 → (x+2)(x+5).",
    minutes_ago: 55 },
  { sender_id: sarah,
    body: "Got it, thank you! Will try the next few from the worksheet.",
    minutes_ago: 30 },
]);

const jamesThread = await upsertThread(james, tutor, mathsCourse);
await upsertMessages(jamesThread, [
  { sender_id: james,
    body: "I submitted assignment 1 — let me know if Q9 working makes sense.",
    minutes_ago: 120 },
]);

console.log("\n✓ Seed complete.");
console.log(`\nTest accounts (password: ${PASSWORD}):`);
for (const u of userDefs) console.log(`  ${u.role.padEnd(8)} ${u.email}`);

// =================================================================
// helpers
// =================================================================

async function findUserId(email) {
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
    if (error) fail(`listUsers: ${error.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 100) return null;
    page += 1;
  }
}

async function upsertCourses(rows) {
  const out = {};
  for (const row of rows) {
    const { data: existing } = await sb.from("courses").select("id").eq("title", row.title).maybeSingle();
    let id;
    if (existing) {
      id = existing.id;
      const { error } = await sb.from("courses").update(row).eq("id", id);
      if (error) fail(`courses.update ${row.title}: ${error.message}`);
    } else {
      const { data, error } = await sb.from("courses").insert(row).select("id").single();
      if (error) fail(`courses.insert ${row.title}: ${error.message}`);
      id = data.id;
    }
    out[row.title] = id;
    log(`course "${row.title}"`);
  }
  return out;
}

async function upsertModules(courseId, rows) {
  const out = {};
  for (const row of rows) {
    const payload = { ...row, course_id: courseId };
    const { data: existing } = await sb.from("modules")
      .select("id").eq("course_id", courseId).eq("title", row.title).maybeSingle();
    let id;
    if (existing) {
      id = existing.id;
      const { error } = await sb.from("modules").update(payload).eq("id", id);
      if (error) fail(`modules.update ${row.title}: ${error.message}`);
    } else {
      const { data, error } = await sb.from("modules").insert(payload).select("id").single();
      if (error) fail(`modules.insert ${row.title}: ${error.message}`);
      id = data.id;
    }
    out[row.title] = id;
  }
  return out;
}

async function upsertLessons(moduleId, rows) {
  for (const row of rows) {
    const payload = { ...row, module_id: moduleId };
    const { data: existing } = await sb.from("lessons")
      .select("id").eq("module_id", moduleId).eq("title", row.title).maybeSingle();
    if (existing) {
      const { error } = await sb.from("lessons").update(payload).eq("id", existing.id);
      if (error) fail(`lessons.update ${row.title}: ${error.message}`);
    } else {
      const { error } = await sb.from("lessons").insert(payload);
      if (error) fail(`lessons.insert ${row.title}: ${error.message}`);
    }
  }
}

async function ensureEnrollment(courseId, studentId) {
  const { data: existing } = await sb.from("enrollments")
    .select("id").eq("course_id", courseId).eq("student_id", studentId).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await sb.from("enrollments")
    .insert({ course_id: courseId, student_id: studentId })
    .select("id").single();
  if (error) fail(`enrollments.insert: ${error.message}`);
  return data.id;
}

async function markProgress(enrollmentId, courseId, lessonsToComplete) {
  const { data: lessons } = await sb
    .from("lessons")
    .select("id, position, modules!inner(course_id, position)")
    .eq("modules.course_id", courseId)
    .order("position", { foreignTable: "modules", ascending: true })
    .order("position", { ascending: true });

  const ordered = (lessons ?? []).slice(0, lessonsToComplete);
  for (const lesson of ordered) {
    const { data: existing } = await sb.from("lesson_progress")
      .select("id").eq("enrollment_id", enrollmentId).eq("lesson_id", lesson.id).maybeSingle();
    if (existing) continue;
    const { error } = await sb.from("lesson_progress")
      .insert({ enrollment_id: enrollmentId, lesson_id: lesson.id });
    if (error) fail(`lesson_progress.insert: ${error.message}`);
  }
}

async function upsertAssignment(courseId, title, instructions, due_at, max_score) {
  const { data: existing } = await sb.from("assignments")
    .select("id").eq("course_id", courseId).eq("title", title).maybeSingle();
  if (existing) {
    await sb.from("assignments").update({ instructions, due_at, max_score }).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await sb.from("assignments")
    .insert({ course_id: courseId, title, instructions, due_at, max_score })
    .select("id").single();
  if (error) fail(`assignments.insert: ${error.message}`);
  return data.id;
}

async function upsertSubmission(assignment_id, student_id, fields) {
  const { data: existing } = await sb.from("submissions")
    .select("id").eq("assignment_id", assignment_id).eq("student_id", student_id).maybeSingle();
  const payload = { assignment_id, student_id, ...fields };
  if (existing) {
    const { error } = await sb.from("submissions").update(payload).eq("id", existing.id);
    if (error) fail(`submissions.update: ${error.message}`);
  } else {
    const { error } = await sb.from("submissions").insert(payload);
    if (error) fail(`submissions.insert: ${error.message}`);
  }
}

async function upsertQuiz(courseId, title, instructions) {
  const { data: existing } = await sb.from("quizzes")
    .select("id").eq("course_id", courseId).eq("title", title).maybeSingle();
  if (existing) {
    await sb.from("quizzes").update({ instructions }).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await sb.from("quizzes")
    .insert({ course_id: courseId, title, instructions })
    .select("id").single();
  if (error) fail(`quizzes.insert: ${error.message}`);
  return data.id;
}

async function upsertQuestions(quiz_id, rows) {
  // wipe + reinsert for determinism
  await sb.from("quiz_questions").delete().eq("quiz_id", quiz_id);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const { error } = await sb.from("quiz_questions").insert({
      quiz_id,
      prompt: r.prompt,
      options: r.options,
      correct_index: r.correct_index,
      position: i,
    });
    if (error) fail(`quiz_questions.insert: ${error.message}`);
  }
}

async function upsertAnnouncement(course_id, author_id, title, body) {
  const { data: existing } = await sb.from("announcements")
    .select("id").eq("course_id", course_id).eq("title", title).maybeSingle();
  if (existing) {
    await sb.from("announcements").update({ body, author_id }).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await sb.from("announcements")
    .insert({ course_id, author_id, title, body })
    .select("id").single();
  if (error) fail(`announcements.insert: ${error.message}`);
  return data.id;
}

async function upsertThread(student_id, tutor_id, course_id) {
  const { data: existing } = await sb.from("threads")
    .select("id").eq("student_id", student_id).eq("tutor_id", tutor_id).eq("course_id", course_id).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await sb.from("threads")
    .insert({ student_id, tutor_id, course_id })
    .select("id").single();
  if (error) fail(`threads.insert: ${error.message}`);
  return data.id;
}

async function upsertMessages(thread_id, rows) {
  // wipe + reinsert for determinism
  await sb.from("messages").delete().eq("thread_id", thread_id);
  for (const r of rows) {
    const created_at = new Date(Date.now() - r.minutes_ago * 60_000).toISOString();
    const { error } = await sb.from("messages").insert({
      thread_id,
      sender_id: r.sender_id,
      body: r.body,
      created_at,
    });
    if (error) fail(`messages.insert: ${error.message}`);
  }
  await sb.from("threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", thread_id);
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

async function uploadDemoSubmission({ localFile, courseId, studentId, assignmentId, ext }) {
  const path = `${courseId}/${studentId}/${assignmentId}.${ext}`;
  const fullPath = join(HERE, "..", "..", "demo-assets", localFile);
  try {
    await access(fullPath);
  } catch {
    console.log(`  (skip upload — ${localFile} not found at ${fullPath})`);
    return path; // still return the path so the row is consistent
  }
  const bytes = await readFile(fullPath);
  const { error } = await sb.storage
    .from("submissions")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) {
    console.log(`  (upload error: ${error.message})`);
    return path;
  }
  return path;
}

async function loadEnv(path) {
  try {
    const raw = await readFile(path, "utf8");
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch { return {}; }
}

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
