import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { electionResultsSchema } from "../src/lib/validations/results.ts";

test("Phase 6: Results aggregation RPC, reconciliation and permissions", async (t) => {
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
  ];

  for (const file of migrationFiles) {
    const raw = await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8");
    const sql = raw.replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
  }

  const electionId = randomUUID();
  const posKetuaId = randomUUID();
  const posSekjenId = randomUUID();

  const candA = randomUUID();
  const candB = randomUUID();
  const candC = randomUUID();
  const candD = randomUUID();
  const candE = randomUUID();

  const voter1 = randomUUID();
  const voter2 = randomUUID();
  const voter3 = randomUUID();
  const voter4 = randomUUID();
  const voter5 = randomUUID();

  // Seed election
  await db.query("insert into elections(id, nama, status) values($1, 'Pemilihan Raya Mahasiswa', 'open')", [electionId]);

  // Seed positions
  await db.query("insert into positions(id, election_id, nama_jabatan, urutan) values($1, $2, 'Ketua Umum', 1)", [posKetuaId, electionId]);
  await db.query("insert into positions(id, election_id, nama_jabatan, urutan) values($1, $2, 'Sekretaris Jenderal', 2)", [posSekjenId, electionId]);

  // Seed candidates
  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 1, 'Kandidat A')", [candA, posKetuaId]);
  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 2, 'Kandidat B')", [candB, posKetuaId]);
  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 3, 'Kandidat C')", [candC, posKetuaId]);

  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 1, 'Kandidat D')", [candD, posSekjenId]);
  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 2, 'Kandidat E')", [candE, posSekjenId]);

  // Seed voters (5 DPT)
  await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-001', 'Pemilih 1')", [voter1, electionId]);
  await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-002', 'Pemilih 2')", [voter2, electionId]);
  await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-003', 'Pemilih 3')", [voter3, electionId]);
  await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-004', 'Pemilih 4')", [voter4, electionId]);
  await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-005', 'Pemilih 5')", [voter5, electionId]);

  const getResults = async (id = electionId) => {
    const res = await db.query("select get_election_results($1) as data", [id]);
    return res.rows[0].data;
  };

  await t.test("Initial empty state returns 0 votes, 0% participation, reconciliation ok", async () => {
    const raw = await getResults();
    const parsed = electionResultsSchema.parse(raw);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.election.nama, "Pemilihan Raya Mahasiswa");
    assert.equal(parsed.election.status, "open");
    assert.equal(parsed.summary.total_dpt, 5);
    assert.equal(parsed.summary.total_voted, 0);
    assert.equal(parsed.summary.participation_percentage, 0);
    assert.equal(parsed.summary.reconciliation_ok, true);
    assert.equal(parsed.summary.is_final, false);

    assert.equal(parsed.positions.length, 2);
    assert.equal(parsed.positions[0].total_votes, 0);
    assert.equal(parsed.positions[0].candidates.length, 3);
    assert.equal(parsed.positions[0].candidates[0].is_highest, false);
  });

  await t.test("Cast votes for 3 voters and verify tallies, percentages, and highest markers", async () => {
    // Voter 1: candA, candD
    await db.query("insert into votes(election_id, position_id, candidate_id) values($1, $2, $3), ($1, $4, $5)", [electionId, posKetuaId, candA, posSekjenId, candD]);
    await db.query("update voters set has_voted = true, voted_at = clock_timestamp() where id = $1", [voter1]);

    // Voter 2: candA, candE
    await db.query("insert into votes(election_id, position_id, candidate_id) values($1, $2, $3), ($1, $4, $5)", [electionId, posKetuaId, candA, posSekjenId, candE]);
    await db.query("update voters set has_voted = true, voted_at = clock_timestamp() where id = $1", [voter2]);

    // Voter 3: candB, candD
    await db.query("insert into votes(election_id, position_id, candidate_id) values($1, $2, $3), ($1, $4, $5)", [electionId, posKetuaId, candB, posSekjenId, candD]);
    await db.query("update voters set has_voted = true, voted_at = clock_timestamp() where id = $1", [voter3]);

    const raw = await getResults();
    const parsed = electionResultsSchema.parse(raw);

    assert.equal(parsed.summary.total_dpt, 5);
    assert.equal(parsed.summary.total_voted, 3);
    assert.equal(parsed.summary.participation_percentage, 60.0);
    assert.equal(parsed.summary.total_votes_cast, 6);
    assert.equal(parsed.summary.reconciliation_ok, true);

    // Position 1: Ketua Umum
    const ketua = parsed.positions.find((p) => p.urutan === 1);
    assert.equal(ketua.total_votes, 3);

    const cA = ketua.candidates.find((c) => c.nomor === 1);
    const cB = ketua.candidates.find((c) => c.nomor === 2);
    const cC = ketua.candidates.find((c) => c.nomor === 3);

    assert.equal(cA.votes, 2);
    assert.equal(cA.percentage, 66.7);
    assert.equal(cA.is_highest, true);

    assert.equal(cB.votes, 1);
    assert.equal(cB.percentage, 33.3);
    assert.equal(cB.is_highest, false);

    assert.equal(cC.votes, 0);
    assert.equal(cC.percentage, 0);
    assert.equal(cC.is_highest, false);

    // Position 2: Sekjen
    const sekjen = parsed.positions.find((p) => p.urutan === 2);
    assert.equal(sekjen.total_votes, 3);

    const cD = sekjen.candidates.find((c) => c.nomor === 1);
    const cE = sekjen.candidates.find((c) => c.nomor === 2);

    assert.equal(cD.votes, 2);
    assert.equal(cD.percentage, 66.7);
    assert.equal(cD.is_highest, true);

    assert.equal(cE.votes, 1);
    assert.equal(cE.percentage, 33.3);
    assert.equal(cE.is_highest, false);
  });

  await t.test("Reconciliation flags mismatch if votes per position differ from voted voters", async () => {
    // Add extra rogue vote for Ketua without voter
    await db.query("insert into votes(election_id, position_id, candidate_id) values($1, $2, $3)", [electionId, posKetuaId, candC]);

    const raw = await getResults();
    const parsed = electionResultsSchema.parse(raw);

    // Now Ketua has 4 votes, but total_voted is still 3 -> mismatch!
    assert.equal(parsed.summary.total_voted, 3);
    assert.equal(parsed.summary.reconciliation_ok, false);

    // Clean up rogue vote
    await db.query("delete from votes where candidate_id = $1", [candC]);
    const restored = electionResultsSchema.parse(await getResults());
    assert.equal(restored.summary.reconciliation_ok, true);
  });

  await t.test("Closed election marks is_final = true", async () => {
    await db.query("update elections set status = 'closed' where id = $1", [electionId]);
    const raw = await getResults();
    const parsed = electionResultsSchema.parse(raw);

    assert.equal(parsed.election.status, "closed");
    assert.equal(parsed.summary.is_final, true);
  });

  await t.test("RLS: anon role cannot select from votes table directly, but can call RPC", async () => {
    await db.exec("set role anon");

    // Direct query to votes must be rejected with permission denied
    await assert.rejects(
      async () => {
        await db.query("select * from votes");
      },
      (err) => err.code === "42501" || /permission denied/i.test(err.message)
    );

    // Calling RPC succeeds and returns aggregated counts safely
    const rpcRes = await db.query("select get_election_results($1) as data", [electionId]);
    const parsed = electionResultsSchema.parse(rpcRes.rows[0].data);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.summary.total_votes_cast, 6);

    await db.exec("reset role");
  });
});
