import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { electionResultsSchema } from "../src/lib/validations/results.ts";

test("Fase 8 QA & Hardening: Concurrency, Code Validation, Non-Open State, Reconciliation & RLS Audit", async (t) => {
  const db = new PGlite();

  // 1. Setup mock Supabase environment
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function public.digest(text, text) returns bytea language sql as 'select sha256(convert_to($1, ''UTF8''))';
  `);

  // Run the full unified schema migration
  const rawMigration = await readFile(new URL("../supabase/migrations/full_schema_all_phases.sql", import.meta.url), "utf8");
  const cleanSql = rawMigration
    .replace(/create extension if not exists pgcrypto;/g, "")
    .replace(/create extension if not exists "uuid-ossp";/g, "");
  await db.exec(cleanSql);

  const hash = (val) => createHash("sha256").update(String(val)).digest("hex");
  const rpc = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.result;

  // Helpers for testing
  const startSession = (sessionToken, code, boothId = null) =>
    rpc("select start_voting_session($1, $2, $3) as result", [hash(sessionToken), code, boothId]);

  const useSession = (sessionToken, action, choices = null) =>
    rpc("select use_voting_session($1, $2, $3::jsonb) as result", [
      hash(sessionToken),
      action,
      choices === null ? null : JSON.stringify(choices),
    ]);

  // Seed baseline election data (draft -> insert positions & candidates -> open)
  const electionId = randomUUID();
  const posKetuaId = randomUUID();
  const posSekjenId = randomUUID();

  const candKetua1 = randomUUID();
  const candKetua2 = randomUUID();
  const candSekjen1 = randomUUID();
  const candSekjen2 = randomUUID();

  await db.query("insert into elections(id, nama, status) values($1, 'Pemilihan Raya Mahasiswa 2026', 'draft')", [electionId]);
  await db.query("insert into positions(id, election_id, nama_jabatan, urutan) values($1, $2, 'Ketua Umum', 1)", [posKetuaId, electionId]);
  await db.query("insert into positions(id, election_id, nama_jabatan, urutan) values($1, $2, 'Sekretaris Jenderal', 2)", [posSekjenId, electionId]);

  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 1, 'Kandidat Ketua 1')", [candKetua1, posKetuaId]);
  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 2, 'Kandidat Ketua 2')", [candKetua2, posKetuaId]);
  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 1, 'Kandidat Sekjen 1')", [candSekjen1, posSekjenId]);
  await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 2, 'Kandidat Sekjen 2')", [candSekjen2, posSekjenId]);

  // Transition from draft to open after positions and candidates are configured
  await db.query("update elections set status = 'open' where id = $1", [electionId]);

  // Seed voters
  const voter1 = randomUUID();
  const voter2 = randomUUID();
  const voter3 = randomUUID();
  const voterConcur = randomUUID();

  await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-VOTER-01', 'Pemilih Pertama')", [voter1, electionId]);
  await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-VOTER-02', 'Pemilih Kedua')", [voter2, electionId]);
  await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-VOTER-03', 'Pemilih Ketiga')", [voter3, electionId]);
  await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-CONCUR-99', 'Pemilih Konkuren')", [voterConcur, electionId]);

  const standardChoices = [
    { position_id: posKetuaId, candidate_id: candKetua1 },
    { position_id: posSekjenId, candidate_id: candSekjen1 },
  ];

  const alternativeChoices = [
    { position_id: posKetuaId, candidate_id: candKetua2 },
    { position_id: posSekjenId, candidate_id: candSekjen2 },
  ];

  // ============================================================================
  // TEST SUITE 1: Concurrency with Same Code (Anti-Double-Vote & Atomicity)
  // ============================================================================
  await t.test("1. Concurrency: Two simultaneous voting sessions using the same code", async () => {
    // Both sessions open using KODE-CONCUR-99 before either has cast a ballot
    const startA = await startSession("token-device-A", "KODE-CONCUR-99");
    assert.equal(startA.ok, true, "Device A starts session");

    const startB = await startSession("token-device-B", "KODE-CONCUR-99");
    assert.equal(startB.ok, true, "Device B starts session with same code concurrently");

    // Both devices now submit their ballots concurrently
    const [resA, resB] = await Promise.all([
      useSession("token-device-A", "cast", standardChoices),
      useSession("token-device-B", "cast", alternativeChoices),
    ]);

    // Exactly one must succeed with submitted, the other must fail with kode_sudah_digunakan
    const oneSubmitted = (resA.state === "submitted" && resB.reason === "kode_sudah_digunakan") ||
                         (resB.state === "submitted" && resA.reason === "kode_sudah_digunakan");
    assert.ok(oneSubmitted, `One session must submit and the other rejected: resA=${JSON.stringify(resA)}, resB=${JSON.stringify(resB)}`);

    // Winner device can retry idempotently (e.g. on network timeout replay)
    const winningToken = resA.state === "submitted" ? "token-device-A" : "token-device-B";
    const losingToken = resA.state === "submitted" ? "token-device-B" : "token-device-A";

    const retryWin = await useSession(winningToken, "cast", standardChoices);
    assert.equal(retryWin.state, "submitted", "Winning session retry is idempotent");

    const retryLose = await useSession(losingToken, "cast", alternativeChoices);
    assert.ok(["sesi_berakhir", "kode_sudah_digunakan"].includes(retryLose.reason), "Losing session retry remains rejected");

    // Verify votes table has exactly 2 rows for this voter's choices (1 per position, NOT 4)
    const votesCount = (await db.query("select count(*)::int as n from votes where election_id = $1", [electionId])).rows[0].n;
    assert.equal(votesCount, 2, "Only 2 total votes inserted across the 2 positions, no duplicate double votes");

    // Verify voter status
    const voterState = (await db.query("select has_voted, voted_at from voters where id = $1", [voterConcur])).rows[0];
    assert.equal(voterState.has_voted, true, "Voter is marked as has_voted = true");
    assert.ok(voterState.voted_at !== null, "voted_at is populated");

    // Verify audit logs contain vote_ditolak or kode_ditolak entry for the losing attempt
    const rejectionAudits = (await db.query("select count(*)::int as n from audit_logs where aksi like '%ditolak%'")).rows[0].n;
    assert.ok(rejectionAudits >= 1, "Audit log contains record of rejected concurrent vote");
  });

  // ============================================================================
  // TEST SUITE 2: Invalid, Malformed, and Already-Used Codes
  // ============================================================================
  await t.test("2. Code Validation: Wrong code and already-used code handling", async () => {
    // 2.1 Non-existent code
    const fakeStart = await startSession("token-fake", "KODE-TIDAK-ADA-999");
    assert.equal(fakeStart.ok, false);
    assert.equal(fakeStart.reason, "kode_tidak_ditemukan");

    // 2.2 Already used code (KODE-CONCUR-99 was voted in Test 1)
    const usedStart = await startSession("token-used", "KODE-CONCUR-99");
    assert.equal(usedStart.ok, false);
    assert.equal(usedStart.reason, "kode_sudah_digunakan");

    // Check audit log for rejected used code
    const auditUsed = (await db.query("select * from audit_logs where aksi = 'kode_ditolak_sudah_digunakan' order by created_at desc limit 1")).rows[0];
    assert.ok(auditUsed, "Audit log records kode_ditolak_sudah_digunakan");
    // Verify fingerprint: raw code must NEVER appear in plain text in audit logs
    assert.equal(JSON.stringify(auditUsed.detail).includes("KODE-CONCUR-99"), false, "Plain text code is not leaked in audit log");
    assert.ok(auditUsed.detail.kode_fingerprint, "Fingerprint SHA-256 hash is recorded instead");

    // 2.3 Malformed choices cannot be cast
    await startSession("token-voter-val", "KODE-VOTER-01");
    // Missing second position
    const partialChoices = [{ position_id: posKetuaId, candidate_id: candKetua1 }];
    const partialRes = await useSession("token-voter-val", "cast", partialChoices);
    assert.equal(partialRes.ok, false);
    assert.equal(partialRes.reason, "pilihan_tidak_lengkap");

    // Invalid candidate ID from another position
    const invalidCandidate = [
      { position_id: posKetuaId, candidate_id: candSekjen1 },
      { position_id: posSekjenId, candidate_id: candSekjen2 },
    ];
    const invalidRes = await useSession("token-voter-val", "cast", invalidCandidate);
    assert.equal(invalidRes.ok, false);
    assert.equal(invalidRes.reason, "kandidat_tidak_valid");

    // Clean up session
    await useSession("token-voter-val", "leave");
  });

  // ============================================================================
  // TEST SUITE 3: Non-Open Election Enforcement (Draft and Closed Status)
  // ============================================================================
  await t.test("3. Non-Open Election: Rejection on draft and closed election", async () => {
    // 3.1 Dedicated draft election
    const draftEid = randomUUID();
    const draftVid = randomUUID();
    await db.query("insert into elections(id, nama, status) values($1, 'Pemilu Draf Uji', 'draft')", [draftEid]);
    await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-DRAFT-01', 'Pemilih Draf')", [draftVid, draftEid]);

    const draftStart = await startSession("token-draft", "KODE-DRAFT-01");
    assert.equal(draftStart.ok, false);
    assert.equal(draftStart.reason, "pemilu_belum_dibuka");

    // 3.2 Dedicated election for closed lifecycle & mid-flight close test
    const closeEid = randomUUID();
    const closePosId = randomUUID();
    const closeCandId = randomUUID();
    const closeVid = randomUUID();

    await db.query("insert into elections(id, nama, status) values($1, 'Pemilu Lifecycle Close', 'draft')", [closeEid]);
    await db.query("insert into positions(id, election_id, nama_jabatan, urutan) values($1, $2, 'Ketua', 1)", [closePosId, closeEid]);
    await db.query("insert into candidates(id, position_id, no_urut, nama) values($1, $2, 1, 'Kandidat')", [closeCandId, closePosId]);
    await db.query("update elections set status = 'open' where id = $1", [closeEid]);
    await db.query("insert into voters(id, election_id, kode_unik, nama) values($1, $2, 'KODE-CLOSE-01', 'Pemilih Close')", [closeVid, closeEid]);

    // Session starts while open
    await startSession("token-close-test", "KODE-CLOSE-01");

    // Admin closes the election
    await db.query("update elections set status = 'closed' where id = $1", [closeEid]);

    // Voter attempts to cast ballot after election is closed
    const midCloseCast = await useSession("token-close-test", "cast", [{ position_id: closePosId, candidate_id: closeCandId }]);
    assert.equal(midCloseCast.ok, false);
    assert.equal(midCloseCast.reason, "pemilu_belum_dibuka", "Cast rejected when election is closed");

    // Ensure no votes written during closed state
    const closeVoterStatus = (await db.query("select has_voted from voters where id = $1", [closeVid])).rows[0].has_voted;
    assert.equal(closeVoterStatus, false, "Voter has_voted remains false");

    // New session attempt on closed election is rejected immediately
    const postCloseStart = await startSession("token-post-close", "KODE-CLOSE-01");
    assert.equal(postCloseStart.ok, false);
    assert.equal(postCloseStart.reason, "pemilu_belum_dibuka");
  });

  // ============================================================================
  // TEST SUITE 4: Vote Reconciliation Integrity
  // ============================================================================
  await t.test("4. Vote Reconciliation: Total votes, participation, and discrepancy detection", async () => {
    // Complete voting for voter 1 and voter 2 on electionId (which is open)
    await startSession("token-v1", "KODE-VOTER-01");
    const castV1 = await useSession("token-v1", "cast", [
      { position_id: posKetuaId, candidate_id: candKetua1 },
      { position_id: posSekjenId, candidate_id: candSekjen1 },
    ]);
    assert.equal(castV1.state, "submitted");

    await startSession("token-v2", "KODE-VOTER-02");
    const castV2 = await useSession("token-v2", "cast", [
      { position_id: posKetuaId, candidate_id: candKetua2 },
      { position_id: posSekjenId, candidate_id: candSekjen1 },
    ]);
    assert.equal(castV2.state, "submitted");

    // Now 3 voters have voted: voterConcur, voter1, voter2.
    // Total DPT for electionId = 4 (voter1, voter2, voter3, voterConcur).
    // Total voted = 3 (75% participation).
    // Total votes cast = 6 (3 for Ketua, 3 for Sekjen).

    const resultsRaw = (await db.query("select public.get_election_results($1) as res", [electionId])).rows[0].res;
    const validated = electionResultsSchema.parse(resultsRaw);

    assert.equal(validated.ok, true);
    assert.equal(validated.summary.total_dpt, 4);
    assert.equal(validated.summary.total_voted, 3);
    assert.equal(validated.summary.participation_percentage, 75);
    assert.equal(validated.summary.total_votes_cast, 6);
    assert.equal(validated.summary.reconciliation_ok, true, "Reconciliation passes when votes match voted voters");

    // Verify candidate vote breakdown
    const ketuaPosition = validated.positions.find((p) => p.id === posKetuaId);
    assert.equal(ketuaPosition.total_votes, 3);
    const cand1Votes = ketuaPosition.candidates.find((c) => c.id === candKetua1).votes;
    const cand2Votes = ketuaPosition.candidates.find((c) => c.id === candKetua2).votes;
    assert.equal(cand1Votes + cand2Votes, 3, "Sum of candidates votes equals position total votes");

    // 4.2 Tampering / Ghost Vote Injection: inject an extra vote in posKetuaId without a voter
    const ghostVoteId = randomUUID();
    await db.query("insert into votes(id, election_id, position_id, candidate_id) values($1, $2, $3, $4)", [
      ghostVoteId,
      electionId,
      posKetuaId,
      candKetua1,
    ]);

    // Fetch results again: position Ketua now has 4 votes, but only 3 voters have voted!
    const tamperedRaw = (await db.query("select public.get_election_results($1) as res", [electionId])).rows[0].res;
    const tamperedRes = electionResultsSchema.parse(tamperedRaw);

    assert.equal(tamperedRes.summary.reconciliation_ok, false, "Reconciliation failure detected when votes count deviates from voted voters!");

    // Clean up ghost vote
    await db.query("delete from votes where id = $1", [ghostVoteId]);

    // Close election and verify final flag
    await db.query("update elections set status = 'closed' where id = $1", [electionId]);
    const finalRaw = (await db.query("select public.get_election_results($1) as res", [electionId])).rows[0].res;
    assert.equal(finalRaw.summary.is_final, true, "is_final is true when election is closed");
    assert.equal(finalRaw.summary.reconciliation_ok, true, "Reconciliation ok restored");
  });

  // ============================================================================
  // TEST SUITE 5: RLS Policies and Service Role Isolation Audit
  // ============================================================================
  await t.test("5. Security & RLS Audit: Anon access boundaries and service-only RPC isolation", async () => {
    // 5.1 Public read elections policy allows anon to select elections
    const anonElection = await db.query("select id, nama, status from elections where id = $1", [electionId]);
    assert.ok(anonElection.rows.length > 0, "Public can read elections metadata");

    // 5.2 Anon CANNOT select from votes table (blocked by REVOKE / permission denied)
    await db.exec("set role anon;");
    try {
      await assert.rejects(
        db.query("select count(*) from votes;"),
        /permission denied for table votes/,
        "Anon role is strictly forbidden from querying votes table directly"
      );
    } finally {
      await db.exec("reset role;");
    }

    // 5.3 Anon CANNOT select sensitive codes or voters directly (blocked by REVOKE)
    await db.exec("set role anon;");
    try {
      await assert.rejects(
        db.query("select count(*) from voters;"),
        /permission denied for table voters/,
        "Anon role is strictly forbidden from querying voters table directly"
      );
    } finally {
      await db.exec("reset role;");
    }

    // 5.4 Check that sensitive RPCs are NOT executable by anon
    const sensitiveFuncs = [
      "start_voting_session(text,text,uuid)",
      "use_voting_session(text,text,jsonb)",
      "booth_attempt(text,text)",
      "manage_voter(uuid,uuid,text,uuid,jsonb)",
    ];

    for (const fn of sensitiveFuncs) {
      const hasPriv = (await db.query("select has_function_privilege('anon', 'public.' || $1, 'execute') as p", [fn])).rows[0].p;
      assert.equal(hasPriv, false, `anon must NOT have execute privilege on public.${fn}`);
    }

    // 5.5 Check that public RPCs ARE executable by anon
    const publicFuncs = [
      "get_election_results(uuid)",
      "get_web_settings()",
    ];

    for (const fn of publicFuncs) {
      const hasPriv = (await db.query("select has_function_privilege('anon', 'public.' || $1, 'execute') as p", [fn])).rows[0].p;
      assert.equal(hasPriv, true, `anon must have execute privilege on public.${fn}`);
    }
  });

  await db.close();
});
