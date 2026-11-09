import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const migrationFiles = [
  "20261109090000_phase_1_schema_and_voting.sql",
  "20261109091000_phase_3.sql",
  "20261109092000_phase_4_dpt.sql",
  "20261109093000_phase_5_booth.sql",
  "20261109094000_phase_6_results.sql",
  "20261109095000_phase_7_settings_and_staff.sql",
];

let fullSql = `-- ==============================================================================
-- SISTEM E-VOTING PEMILU: FULL DATABASE SCHEMA & MIGRATIONS (FASE 1 - 7)
-- Jalankan file ini secara menyeluruh di Supabase SQL Editor
-- ==============================================================================

begin;

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

`;

for (const file of migrationFiles) {
  fullSql += `\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n`;
  fullSql += `-- MIGRATION: ${file}\n`;
  fullSql += `-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n\n`;
  
  let content = await readFile(join("supabase", "migrations", file), "utf8");
  
  // Clean redundant begin/commit inside the concatenated body so it's a single atomic transaction
  content = content.replace(/^\s*begin\s*;\s*$/gmi, "-- (nested begin omitted)");
  content = content.replace(/^\s*commit\s*;\s*$/gmi, "-- (nested commit omitted)");
  
  fullSql += content.trim() + "\n";
}

fullSql += `\n-- ==============================================================================
-- FINAL COMMIT
-- ==============================================================================
commit;
`;

await writeFile(join("supabase", "migrations", "full_schema_all_phases.sql"), fullSql, "utf8");
console.log("Successfully generated supabase/migrations/full_schema_all_phases.sql");

