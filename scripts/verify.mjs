#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = await loadEnv(join(HERE, "..", ".env.local"));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tables = [
  "profiles", "courses", "modules", "lessons",
  "enrollments", "lesson_progress",
  "assignments", "submissions",
  "quizzes", "quiz_questions",
  "announcements", "threads", "messages",
];

console.log("Row counts:");
for (const t of tables) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  console.log(`  ${t.padEnd(20)} ${error ? `ERROR ${error.message}` : count}`);
}

console.log("\nProgress check (Sarah's GCSE Maths should be 60%):");
const { data: enrols } = await sb
  .from("enrollments")
  .select("id, course_id, profiles!enrollments_student_id_fkey(full_name), courses(title)");
for (const e of enrols ?? []) {
  const { data: lessonsData } = await sb
    .from("lessons")
    .select("id, modules!inner(course_id)")
    .eq("modules.course_id", e.course_id);
  const total = lessonsData?.length ?? 0;
  const { count: done } = await sb
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("enrollment_id", e.id);
  const pct = total === 0 ? 0 : Math.round((100 * (done ?? 0)) / total);
  console.log(`  ${e.profiles.full_name.padEnd(18)} ${e.courses.title.padEnd(55)} ${done}/${total} = ${pct}%`);
}

async function loadEnv(path) {
  const raw = await readFile(path, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
