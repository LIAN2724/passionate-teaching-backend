#!/usr/bin/env node
/**
 * Apply every migration in supabase/migrations/ in order to the linked
 * Supabase project, using the Management API SQL endpoint.
 *
 *   node scripts/apply-migrations.mjs            # apply all
 *   node scripts/apply-migrations.mjs 0002       # apply just one
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "supabase", "migrations");

const env = await loadEnv(join(HERE, "..", ".env.local"));
const PROJECT_REF = env.SUPABASE_PROJECT_REF;
const PAT = env.SUPABASE_PERSONAL_ACCESS_TOKEN;
if (!PROJECT_REF || !PAT) {
  fail("Missing SUPABASE_PROJECT_REF or SUPABASE_PERSONAL_ACCESS_TOKEN in .env.local");
}

const filterArg = process.argv[2];

const files = (await readdir(MIGRATIONS_DIR))
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) fail("No .sql migrations found.");

const targets = filterArg ? files.filter((f) => f.startsWith(filterArg)) : files;
if (targets.length === 0) fail(`No migrations matched filter "${filterArg}".`);

console.log(`→ Applying ${targets.length} migration(s) to project ${PROJECT_REF}\n`);

for (const file of targets) {
  const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
  process.stdout.write(`  • ${file} … `);
  try {
    await runSql(sql);
    console.log("ok");
  } catch (err) {
    console.log("FAIL");
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }
}

console.log("\n✓ Migrations applied.");

// ---------- helpers ----------------------------------------------

async function runSql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} — ${text}`);
  }
  return res.json();
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
  } catch {
    return {};
  }
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
