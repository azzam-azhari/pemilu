import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { managementSchema } from "../src/lib/validations/management.ts";

test("Election Status Lifecycle: Reopen, Revert to Draft, and Edit Closed Elections", async (t) => {
  // Setup standalone in-memory database with unified schema
  const db = new PGlite();

  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    grant usage on schema auth to authenticated, anon;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    grant execute on function auth.uid() to authenticated, anon;
    create function public.digest(text, text) returns bytea language sql as 'select sha256(convert_to($1, ''UTF8''))';
  `);

  const raw = await readFile(new URL("../supabase/migrations/full_schema_all_phases.sql", import.meta.url), "utf8");
  const sql = raw.replace(/create extension if not exists pgcrypto;/g, "").replace(/create extension if not exists "uuid-ossp";/g, "");
  await db.exec(sql);

  await t.test("1. Zod Validation: managementSchema accepts status draft, open, closed", () => {
    const draftParsed = managementSchema.parse({
      entity: "elections",
      nama: "Pemilu Raya Mahasiswa",
      nomor: 1,
      mulai: "2026-11-20",
      selesai: "2026-11-25",
      info: "",
      visi_misi: "",
      status: "draft",
    });
    assert.equal(draftParsed.status, "draft");

    const openParsed = managementSchema.parse({
      entity: "elections",
      nama: "Pemilu Raya Mahasiswa",
      nomor: 1,
      mulai: "",
      selesai: "",
      info: "",
      visi_misi: "",
      status: "open",
    });
    assert.equal(openParsed.status, "open");

    const closedParsed = managementSchema.parse({
      entity: "elections",
      nama: "Pemilu Raya Mahasiswa",
      nomor: 1,
      mulai: "",
      selesai: "",
      info: "",
      visi_misi: "",
      status: "closed",
    });
    assert.equal(closedParsed.status, "closed");
  });

  await t.test("2. Database: Reopening closed elections, revert to draft, and edit closed election metadata", async () => {
    const eid = randomUUID();
    const pid = randomUUID();
    const cid = randomUUID();

    // Insert draft election
    await db.query("insert into elections(id, nama, status) values($1, 'Pemilu 2026', 'draft')", [eid]);

    // Opening without position/candidate must throw error
    await assert.rejects(
      async () => {
        await db.query("update elections set status='open' where id=$1", [eid]);
      },
      /Isi jabatan dan kandidat sebelum membuka pemilu/
    );

    // Add position and candidate
    await db.query("insert into positions(id, election_id, nama_jabatan, urutan) values($1, $2, 'Ketua', 1)", [pid, eid]);
    await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 1, 'Calon 1')", [cid, pid]);

    // Open election -> Success
    await db.query("update elections set status='open' where id=$1", [eid]);
    let row = (await db.query("select status, nama from elections where id=$1", [eid])).rows[0];
    assert.equal(row.status, "open");

    // Close election -> Success
    await db.query("update elections set status='closed' where id=$1", [eid]);
    row = (await db.query("select status, nama from elections where id=$1", [eid])).rows[0];
    assert.equal(row.status, "closed");

    // Edit closed election metadata (name and dates) while closed -> Success
    await db.query("update elections set nama='Pemilu 2026 Selesai', periode_mulai=now() where id=$1", [eid]);
    row = (await db.query("select nama from elections where id=$1", [eid])).rows[0];
    assert.equal(row.nama, "Pemilu 2026 Selesai");

    // Reopen closed election (closed -> open) -> Success!
    await db.query("update elections set status='open' where id=$1", [eid]);
    row = (await db.query("select status from elections where id=$1", [eid])).rows[0];
    assert.equal(row.status, "open");

    // Revert open election to draft (open -> draft) -> Success!
    await db.query("update elections set status='draft' where id=$1", [eid]);
    row = (await db.query("select status from elections where id=$1", [eid])).rows[0];
    assert.equal(row.status, "draft");

    // Transition draft -> closed -> Success!
    await db.query("update elections set status='closed' where id=$1", [eid]);
    row = (await db.query("select status from elections where id=$1", [eid])).rows[0];
    assert.equal(row.status, "closed");

    // Revert closed election to draft (closed -> draft) -> Success!
    await db.query("update elections set status='draft' where id=$1", [eid]);
    row = (await db.query("select status from elections where id=$1", [eid])).rows[0];
    assert.equal(row.status, "draft");

    // Delete when draft -> Success!
    await db.query("delete from elections where id=$1", [eid]);
    const count = (await db.query("select count(*) from elections where id=$1", [eid])).rows[0].count;
    assert.equal(count, 0);
  });
});
