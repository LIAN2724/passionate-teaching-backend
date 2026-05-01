#!/usr/bin/env node
/**
 * Wipe the volatile data (messages, quiz attempts/answers, lesson_progress,
 * submissions) so seed.mjs can put the canonical demo state back exactly.
 *
 *   node scripts/reset.mjs && node scripts/seed.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const env = await loadEnv(join(HERE, "..", ".env.local"));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NIL = "00000000-0000-0000-0000-000000000000";

// Order matters — children before parents so FK cascade isn't required.
for (const t of [
  "quiz_answers",
  "quiz_attempts",
  "messages",
  "submissions",
  "lesson_progress",
]) {
  const { error } = await sb.from(t).delete().neq("id", NIL);
  console.log(`  ${error ? "✗" : "•"} cleared ${t}${error ? ` — ${error.message}` : ""}`);
}

console.log("\n✓ Volatile data cleared. Now run: npm run seed");

async function loadEnv(path) {
  const raw = await readFile(path, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
