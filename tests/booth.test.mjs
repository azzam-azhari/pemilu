import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { codeSchema, choicesSchema } from "../src/lib/validations/booth.ts";

test("Zod normalizes seed codes and rejects malformed choices",()=>{
  assert.equal(codeSchema.parse(" pemilu-001 "),"PEMILU-001");
  assert.equal(codeSchema.safeParse("bad!").success,false);
  const choice={position_id:randomUUID(),candidate_id:randomUUID()};
  assert.equal(choicesSchema.safeParse([choice,choice]).success,false);
  assert.equal(choicesSchema.safeParse(null).success,false);
  assert.equal(choicesSchema.safeParse([{...choice,candidate_id:"bad"}]).success,false);
});
test("PostgreSQL session, voting, limits, rollback and permissions",async t=>{
  const db=new PGlite();
  // Minimal Supabase fixtures. Core PostgreSQL sha256 substitutes only pgcrypto
  // digest(text,'sha256') in this local test engine.
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function public.digest(text,text) returns bytea language sql as 'select sha256(convert_to($1, ''UTF8''))';
  `);
  const migration=await readFile(new URL("../supabase/migrations/20261109090000_phase_1_schema_and_voting.sql",import.meta.url),"utf8");
  await db.exec(migration.replace("create extension if not exists pgcrypto;",""));
  for(const name of ["20261109092000_phase_4_dpt.sql","20261109093000_phase_5_booth.sql"])await db.exec(await readFile(new URL("../supabase/migrations/"+name,import.meta.url),"utf8"));
  const eid=randomUUID(),pid=randomUUID(),cid=randomUUID(),vid=randomUUID();
  const hash=n=>createHash("sha256").update(String(n)).digest("hex");
  await db.query("insert into elections(id,nama,status) values($1,'Uji Bilik','open')",[eid]);
  await db.query("insert into positions(id,election_id,nama_jabatan,urutan) values($1,$2,'Ketua',1)",[pid,eid]);
  await db.query("insert into candidates(id,position_id,no_urut,nama) values($1,$2,1,'Kandidat Uji')",[cid,pid]);
  await db.query("insert into voters(id,election_id,kode_unik,nama) values($1,$2,'TEST-001','Pemilih Uji')",[vid,eid]);
  const rpc=async(sql,args)=>(await db.query(sql,args)).rows[0].result;
  const start=h=>rpc("select start_voting_session($1,'TEST-001',null) result",[h]);
  const use=(h,a,c=null)=>rpc("select use_voting_session($1,$2,$3::jsonb) result",[h,a,c===null?null:JSON.stringify(c)]);
  const choices=[{position_id:pid,candidate_id:cid}];
  await t.test("rate limiter counts invalid attempts, expires windows, shared IP cap",async()=>{
    for(let i=0;i<10;i++)assert.equal(await rpc("select booth_attempt($1,$2) result",[hash("device"),hash("ip")]),0);
    assert.ok(await rpc("select booth_attempt($1,$2) result",[hash("device"),hash("ip")])>0);
    for(let i=0;i<49;i++)assert.equal(await rpc("select booth_attempt($1,$2) result",[hash("other"+i),hash("ip")]),0);
    assert.ok(await rpc("select booth_attempt($1,$2) result",[hash("new"),hash("ip")])>0);
    await db.exec("update booth_rate_limits set starts_at=clock_timestamp()-interval '61 seconds'");
    assert.equal(await rpc("select booth_attempt($1,$2) result",[hash("device"),hash("ip")]),0);
  });
  await t.test("wrong code, non-open election and unknown session fail",async()=>{
    assert.equal((await rpc("select start_voting_session($1,'WRONG-01',null) result",[hash(0)])).ok,false);
    assert.equal((await use(hash("fake"),"read")).reason,"sesi_berakhir");
    await db.query("update elections set status='closed' where id=$1",[eid]);
    assert.equal((await start(hash(0))).reason,"pemilu_belum_dibuka");
    await db.query("update elections set status='open' where id=$1",[eid]);
  });
  await t.test("read doesn't renew idle, touch does; expiry and logout reject",async()=>{
    await start(hash(1));
    const before=(await db.query("select last_activity from voting_sessions where token_hash=$1",[hash(1)])).rows[0].last_activity;
    const read=await use(hash(1),"read");assert.equal(read.positions[0].candidates[0].id,cid);
    assert.equal(JSON.stringify(read).includes("Pemilih Uji"),false);
    const after=(await db.query("select last_activity from voting_sessions where token_hash=$1",[hash(1)])).rows[0].last_activity;
    assert.equal(String(before),String(after));
    await db.query("update voting_sessions set last_activity=clock_timestamp()-interval '90 seconds' where token_hash=$1",[hash(1)]);
    assert.ok((await use(hash(1),"touch")).remainingMs>110000);
    await db.query("update voting_sessions set last_activity=clock_timestamp()-interval '121 seconds' where token_hash=$1",[hash(1)]);
    assert.equal((await use(hash(1),"cast",choices)).reason,"sesi_berakhir");
    await start(hash(2));await use(hash(2),"leave");
    assert.equal((await use(hash(2),"read")).ok,false);
    await start(hash(3));await db.query("update voting_sessions set expires_at=clock_timestamp()-interval '1 second' where token_hash=$1",[hash(3)]);
    assert.equal((await use(hash(3),"read")).ok,false);
  });
  await t.test("resetting a code invalidates an existing session",async()=>{
    await start(hash(4));
    await db.query("update voters set kode_unik='TEST-002' where id=$1",[vid]);
    assert.equal((await use(hash(4),"cast",choices)).reason,"sesi_berakhir");
    await db.query("update voters set kode_unik='TEST-001' where id=$1",[vid]);
  });
  await t.test("booth binding and closing an election invalidate access",async()=>{
    const bid=randomUUID(),other=randomUUID();
    await db.query("insert into elections(id,nama,status) values($1,'Pemilu Lain','open')",[other]);
    await db.query("insert into booths(id,election_id,nama,status) values($1,$2,'Bilik Uji','kosong')",[bid,other]);
    assert.equal((await rpc("select start_voting_session($1,'TEST-001',$2) result",[hash("other-booth"),bid])).ok,false);
    await db.query("update booths set election_id=$1,status='nonaktif' where id=$2",[eid,bid]);
    assert.equal((await rpc("select start_voting_session($1,'TEST-001',$2) result",[hash("inactive-booth"),bid])).reason,"bilik_tidak_valid");
    await start(hash("close-test"));
    await db.query("update elections set status='closed' where id=$1",[eid]);
    assert.equal((await use(hash("close-test"),"cast",choices)).reason,"pemilu_belum_dibuka");
    await db.query("update elections set status='open' where id=$1",[eid]);
  });
  await t.test("malformed choices and mismatched candidate cannot write votes",async()=>{
    await start(hash(5));
    for(const value of [null,{},[],[choices[0],choices[0]],[{position_id:"bad",candidate_id:cid}],[{position_id:pid,candidate_id:randomUUID()}]])assert.equal((await use(hash(5),"cast",value)).ok,false);
    assert.equal((await db.query("select count(*)::int n from votes")).rows[0].n,0);
  });
  await t.test("audit failure rolls back vote, voter and session together",async()=>{
    await db.exec("create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'test audit failure'; end $$; create trigger fail_audit before insert on audit_logs for each row execute function fail_audit()");
    await assert.rejects(use(hash(5),"cast",choices));
    assert.equal((await db.query("select count(*)::int n from votes")).rows[0].n,0);
    assert.equal((await db.query("select has_voted from voters where id=$1",[vid])).rows[0].has_voted,false);
    await db.exec("drop trigger fail_audit on audit_logs");
  });
  await t.test("second session loses; same-session retries succeed idempotently",async()=>{
    await start(hash(6));
    assert.equal((await use(hash(5),"cast",choices)).state,"submitted");
    assert.equal((await use(hash(5),"cast",choices)).state,"submitted");
    assert.equal((await use(hash(6),"cast",choices)).reason,"kode_sudah_digunakan");
    assert.equal((await start(hash(7))).reason,"kode_sudah_digunakan");
    assert.equal((await db.query("select count(*)::int n from votes")).rows[0].n,1);
    assert.ok((await db.query("select count(*)::int n from audit_logs where aksi like '%ditolak%'")).rows[0].n>=2);
  });
  await t.test("public RPCs and session tables are closed; votes contain no voter/session identifiers",async()=>{
    for(const signature of ["verify_code(text)","cast_vote(text,jsonb)","start_voting_session(text,text,uuid)","use_voting_session(text,text,jsonb)","booth_attempt(text,text)"])
      for(const role of ["anon","authenticated"])assert.equal(await rpc("select has_function_privilege($1,$2,'execute') result",[role,"public."+signature]),false);
    const cols=(await db.query("select column_name from information_schema.columns where table_name='votes' and table_schema='public'")).rows.map(r=>r.column_name);
    assert.deepEqual(cols.sort(),["id","election_id","position_id","candidate_id","created_at"].sort());
  });
  await db.close();
});
