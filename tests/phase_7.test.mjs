import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { csvCell } from "../src/lib/dpt.ts";

test("Phase 7: Staff, Booths, Realtime status, Audit Log, and Web Settings", async (t) => {
  const db = new PGlite();

  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function public.digest(text, text) returns bytea language sql as 'select sha256(convert_to($1, ''UTF8''))';
  `);

  const migrationFiles = [
    "20261109090000_phase_1_schema_and_voting.sql",
    "20261109092000_phase_4_dpt.sql",
    "20261109093000_phase_5_booth.sql",
    "20261109094000_phase_6_results.sql",
    "20261109095000_phase_7_settings_and_staff.sql",
  ];

  for (const file of migrationFiles) {
    const raw = await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8");
    const sql = raw.replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
  }

  const adminId = randomUUID();
  await db.query("insert into auth.users(id, email) values($1, 'admin@pemilu.local')", [adminId]);

  // Mock auth.uid to return adminId by default
  await db.exec(`create or replace function auth.uid() returns uuid language sql as 'select ''${adminId}''::uuid'`);

  const electionId = randomUUID();
  const positionId = randomUUID();
  const candidateId = randomUUID();

  await db.query("insert into elections(id, nama, status) values($1, 'Pemilu 2026', 'open')", [electionId]);
  await db.query("insert into positions(id, election_id, nama_jabatan, urutan) values($1, $2, 'Ketua', 1)", [positionId, electionId]);
  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 1, 'Kandidat 1')", [candidateId, positionId]);

  await t.test("Staff & Booth CRUD and foreign key on delete set null", async () => {
    const boothId = randomUUID();
    await db.query("insert into booths(id, election_id, nama, status) values($1, $2, 'Bilik 1', 'kosong')", [boothId, electionId]);

    const staffId = randomUUID();
    await db.query("insert into staff(id, nama, booth_id) values($1, 'Petugas Ahmad', $2)", [staffId, boothId]);

    const checkStaff = (await db.query("select * from staff where id = $1", [staffId])).rows[0];
    assert.equal(checkStaff.booth_id, boothId);

    // Delete booth -> staff.booth_id must become null
    await db.query("delete from booths where id = $1", [boothId]);
    const afterBoothDelete = (await db.query("select * from staff where id = $1", [staffId])).rows[0];
    assert.equal(afterBoothDelete.booth_id, null);
  });

  await t.test("Real-time booth status automation: start session marks terpakai, cast/leave restores kosong", async () => {
    const boothId = randomUUID();
    await db.query("insert into booths(id, election_id, nama, status) values($1, $2, 'Bilik Cepat', 'kosong')", [boothId, electionId]);

    const voterId = randomUUID();
    await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-BILIK-1', 'Pemilih Bilik')", [voterId, electionId]);

    const tokenHash = createHash("sha256").update("token-bilik-session").digest("hex");

    // 1. Start voting session at booth
    const startRes = (await db.query("select start_voting_session($1, 'KODE-BILIK-1', $2) as res", [tokenHash, boothId])).rows[0].res;
    assert.equal(startRes.ok, true);

    // Booth must be marked 'terpakai'
    const boothInUse = (await db.query("select status from booths where id = $1", [boothId])).rows[0];
    assert.equal(boothInUse.status, "terpakai");

    // 2. Cast vote
    const choices = JSON.stringify([{ position_id: positionId, candidate_id: candidateId }]);
    const castRes = (await db.query("select use_voting_session($1, 'cast', $2::jsonb) as res", [tokenHash, choices])).rows[0].res;
    assert.equal(castRes.ok, true);

    // Booth must return to 'kosong'
    const boothIdle = (await db.query("select status from booths where id = $1", [boothId])).rows[0];
    assert.equal(boothIdle.status, "kosong");
  });

  await t.test("Web Settings: get_web_settings defaults and save_web_settings audit tracking", async () => {
    // 1. Initial settings
    const defaultSettings = (await db.query("select get_web_settings() as data")).rows[0].data;
    assert.equal(defaultSettings.nama_penyelenggara, "Panitia Pemilihan Umum");
    assert.equal(defaultSettings.tampilkan_hasil_live, true);

    // 2. Save new settings
    const newSettings = {
      nama_penyelenggara: "KPU Mahasiswa 2026",
      logo_url: "https://example.com/logo.png",
      tema: "dark",
      format_kode_prefix: "KPU-",
      format_kode_length: 8,
      tampilkan_hasil_live: false,
    };

    const saveRes = (await db.query("select save_web_settings($1::jsonb) as res", [JSON.stringify(newSettings)])).rows[0].res;
    assert.equal(saveRes.ok, true);
    assert.equal(saveRes.settings.nama_penyelenggara, "KPU Mahasiswa 2026");
    assert.equal(saveRes.settings.tampilkan_hasil_live, false);

    // 3. Verify get_web_settings returns updated settings
    const updated = (await db.query("select get_web_settings() as data")).rows[0].data;
    assert.equal(updated.nama_penyelenggara, "KPU Mahasiswa 2026");
    assert.equal(updated.tampilkan_hasil_live, false);

    // 4. Verify audit_logs contains ubah_pengaturan_web
    const audit = (await db.query("select * from audit_logs where aksi = 'ubah_pengaturan_web'")).rows[0];
    assert.ok(audit);
    assert.equal(audit.detail.pengaturan.nama_penyelenggara, "KPU Mahasiswa 2026");
  });

  await t.test("Export CSV cell sanitizes formula injection", () => {
    assert.equal(csvCell("=1+1"), "\"'=1+1\"");
    assert.equal(csvCell("+cmd|' /C calc'!A0"), "\"'+cmd|' /C calc'!A0\"");
    assert.equal(csvCell("@SUM(A1:A10)"), "\"\'@SUM(A1:A10)\"");
    assert.equal(csvCell("-5"), "\"'-5\"");
    assert.equal(csvCell("Biasa"), "\"Biasa\"");
    assert.equal(csvCell('Dengan "Kutip"'), '"Dengan ""Kutip"""');
  });

  await t.test("Permissions: anon can read web settings, but cannot save settings or read audit logs", async () => {
    await db.exec("set role anon");

    // Anon can read web settings
    const anonSettings = (await db.query("select get_web_settings() as data")).rows[0].data;
    assert.ok(anonSettings.nama_penyelenggara);

    // Anon cannot save web settings (permission denied on function or returns not admin)
    await assert.rejects(
      async () => {
        await db.query("select save_web_settings('{}'::jsonb)");
      },
      (err) => err.code === "42501" || /permission denied/i.test(err.message)
    );

    // Anon cannot select audit_logs
    await assert.rejects(
      async () => {
        await db.query("select * from audit_logs");
      },
      (err) => err.code === "42501" || /permission denied/i.test(err.message)
    );

    await db.exec("reset role");
  });
});
