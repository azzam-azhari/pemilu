import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Migration Validation: Full unified schema and isolated phase 7", async (t) => {
  await t.test("Full schema all phases runs cleanly in empty database", async () => {
    const db = new PGlite();

    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create function public.digest(text, text) returns bytea language sql as 'select sha256(convert_to($1, ''UTF8''))';
    `);

    const raw = await readFile(new URL("../supabase/migrations/full_schema_all_phases.sql", import.meta.url), "utf8");
    const sql = raw.replace(/create extension if not exists pgcrypto;/g, "").replace(/create extension if not exists "uuid-ossp";/g, "");
    
    // Execute the unified migration
    await db.exec(sql);

    // Verify all essential tables exist
    const tables = await db.query(`
      select table_name from information_schema.tables 
      where table_schema = 'public' and table_type = 'BASE TABLE'
    `);
    const tableNames = tables.rows.map(r => r.table_name);
    
    const expected = [
      "elections", "positions", "candidates", "voters", "booths", 
      "admins", "staff", "settings", "audit_logs", "votes", 
      "voting_sessions", "booth_rate_limits"
    ];
    for (const name of expected) {
      assert.ok(tableNames.includes(name), `Missing table: ${name}`);
    }

    // Verify get_web_settings RPC works
    const res = await db.query("select public.get_web_settings() as settings");
    assert.ok(res.rows[0].settings.nama_penyelenggara);
  });

  await t.test("Phase 7 migration works even if Phase 5 was not run prior", async () => {
    const db = new PGlite();

    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create function public.digest(text, text) returns bytea language sql as 'select sha256(convert_to($1, ''UTF8''))';
    `);

    // Only run Phase 1
    const p1Raw = await readFile(new URL("../supabase/migrations/20261109090000_phase_1_schema_and_voting.sql", import.meta.url), "utf8");
    await db.exec(p1Raw.replace(/create extension if not exists pgcrypto;/g, ""));

    // Now run Phase 7 directly (skipping Phase 2-6)
    const p7Raw = await readFile(new URL("../supabase/migrations/20261109095000_phase_7_settings_and_staff.sql", import.meta.url), "utf8");
    
    // Should NOT throw relation "public.voting_sessions" does not exist!
    await assert.doesNotReject(async () => {
      await db.exec(p7Raw);
    });

    const tables = await db.query(`
      select table_name from information_schema.tables 
      where table_schema = 'public' and table_name in ('voting_sessions', 'booth_rate_limits', 'staff', 'settings')
    `);
    assert.equal(tables.rows.length, 4);
  });
});
