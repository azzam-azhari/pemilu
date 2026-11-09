-- ==============================================================================
-- SISTEM E-VOTING PEMILU: FULL DATABASE SCHEMA & MIGRATIONS (FASE 1 - 7)
-- Jalankan file ini secara menyeluruh di Supabase SQL Editor
-- 
-- CATATAN PENTING:
-- Jika Anda ingin memulai dari awal di Supabase (database baru / reset pengujian),
-- Anda dapat menjalankan 4 baris di bawah ini terlebih dahulu (uncomment jika perlu):
--
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- GRANT ALL ON SCHEMA public TO postgres;
-- GRANT ALL ON SCHEMA public TO public;
-- ==============================================================================

begin;

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261109090000_phase_1_schema_and_voting.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

create extension if not exists pgcrypto;

create type public.election_status as enum ('draft', 'open', 'closed');
create type public.booth_status as enum ('kosong', 'terpakai', 'nonaktif');

create table public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null check (char_length(trim(nama)) between 2 and 120),
  email text not null unique check (email = lower(email)),
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- Every Auth user is an administrator for this application. Public sign-up must
-- remain disabled in Supabase Auth so only an operator can create admin users.
create or replace function public.sync_admin_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nama text;
begin
  -- This application supports email/password admins only.
  if new.email is null then
    return new;
  end if;

  v_nama := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'nama'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(split_part(new.email, '@', 1)), ''),
    'Admin'
  );
  v_nama := left(v_nama, 120);
  if char_length(v_nama) < 2 then
    v_nama := 'Admin';
  end if;

  insert into public.admins (id, nama, email, role)
  values (new.id, v_nama, lower(new.email), 'admin')
  on conflict (id) do update
  set nama = excluded.nama,
      email = excluded.email,
      role = excluded.role;

  return new;
end;
$$;

create trigger sync_admin_from_auth_user
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_admin_from_auth_user();

create table public.elections (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(trim(nama)) between 3 and 200),
  periode_mulai timestamptz,
  periode_selesai timestamptz,
  status public.election_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periode_selesai is null or periode_mulai is null or periode_selesai > periode_mulai)
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  nama_jabatan text not null check (char_length(trim(nama_jabatan)) between 2 and 160),
  urutan integer not null check (urutan > 0),
  created_at timestamptz not null default now(),
  unique (election_id, urutan),
  unique (id, election_id)
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.positions(id) on delete cascade,
  no_urut integer not null check (no_urut > 0),
  nama text not null check (char_length(trim(nama)) between 2 and 160),
  foto text,
  info text,
  visi_misi text,
  created_at timestamptz not null default now(),
  unique (position_id, no_urut)
);

create table public.voters (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  kode_unik text not null unique check (char_length(kode_unik) between 6 and 64),
  nama text not null check (char_length(trim(nama)) between 2 and 160),
  kelompok text,
  has_voted boolean not null default false,
  voted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((has_voted and voted_at is not null) or (not has_voted and voted_at is null))
);

-- Deliberately anonymous: there is no voter_id, kode_unik, or other voter identity here.
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete restrict,
  position_id uuid not null references public.positions(id) on delete restrict,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.booths (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections(id) on delete cascade,
  nama text not null check (char_length(trim(nama)) between 2 and 120),
  status public.booth_status not null default 'kosong',
  created_at timestamptz not null default now(),
  unique (election_id, nama)
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(trim(nama)) between 2 and 160),
  booth_id uuid references public.booths(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  aksi text not null check (char_length(trim(aksi)) between 3 and 100),
  aktor text not null default 'sistem',
  detail jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key check (char_length(trim(key)) between 2 and 100),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index voters_election_has_voted_idx on public.voters (election_id, has_voted);
create index positions_election_urutan_idx on public.positions (election_id, urutan);
create index candidates_position_no_urut_idx on public.candidates (position_id, no_urut);
create index votes_election_position_idx on public.votes (election_id, position_id);
create index votes_candidate_idx on public.votes (candidate_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger elections_set_updated_at
before update on public.elections
for each row execute function public.set_updated_at();

create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.admins enable row level security;
alter table public.elections enable row level security;
alter table public.positions enable row level security;
alter table public.candidates enable row level security;
alter table public.voters enable row level security;
alter table public.votes enable row level security;
alter table public.booths enable row level security;
alter table public.staff enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;

create policy "admin manage admins" on public.admins
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage elections" on public.elections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage positions" on public.positions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage candidates" on public.candidates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage voters" on public.voters
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read votes" on public.votes
  for select to authenticated using (public.is_admin());
create policy "admin manage booths" on public.booths
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage staff" on public.staff
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read audit logs" on public.audit_logs
  for select to authenticated using (public.is_admin());
create policy "admin manage settings" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.code_fingerprint(p_kode text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(trim(upper(p_kode)), 'sha256'), 'hex');
$$;

create or replace function public.write_voting_audit(p_aksi text, p_kode text, p_election_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (aksi, aktor, detail)
  values (
    p_aksi,
    'sistem',
    jsonb_strip_nulls(jsonb_build_object('kode_fingerprint', public.code_fingerprint(p_kode), 'election_id', p_election_id))
  );
end;
$$;

-- This RPC intentionally returns only election metadata, never voter identity.
create or replace function public.verify_code(p_kode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter public.voters%rowtype;
  v_election public.elections%rowtype;
begin
  if p_kode is null or char_length(trim(p_kode)) < 6 then
    return jsonb_build_object('valid', false, 'reason', 'kode_tidak_valid');
  end if;

  select * into v_voter from public.voters where kode_unik = trim(upper(p_kode));
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'kode_tidak_ditemukan');
  end if;

  select * into v_election from public.elections where id = v_voter.election_id;
  if v_voter.has_voted then
    perform public.write_voting_audit('kode_ditolak_sudah_digunakan', p_kode, v_voter.election_id);
    return jsonb_build_object('valid', false, 'reason', 'kode_sudah_digunakan');
  end if;

  if v_election.status <> 'open' then
    return jsonb_build_object('valid', false, 'reason', 'pemilu_belum_dibuka');
  end if;

  return jsonb_build_object('valid', true, 'election_id', v_election.id, 'election_name', v_election.nama);
end;
$$;

create or replace function public.cast_vote(p_kode text, p_pilihan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter public.voters%rowtype;
  v_position_count integer;
  v_choice_count integer;
  v_valid_choice_count integer;
begin
  if p_kode is null or char_length(trim(p_kode)) < 6 then
    return jsonb_build_object('ok', false, 'reason', 'kode_tidak_valid');
  end if;
  if jsonb_typeof(p_pilihan) <> 'array' or jsonb_array_length(p_pilihan) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'pilihan_tidak_valid');
  end if;

  select * into v_voter
  from public.voters
  where kode_unik = trim(upper(p_kode))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'kode_tidak_ditemukan');
  end if;
  if v_voter.has_voted then
    perform public.write_voting_audit('vote_ditolak_kode_sudah_digunakan', p_kode, v_voter.election_id);
    return jsonb_build_object('ok', false, 'reason', 'kode_sudah_digunakan');
  end if;
  if not exists (select 1 from public.elections where id = v_voter.election_id and status = 'open') then
    return jsonb_build_object('ok', false, 'reason', 'pemilu_belum_dibuka');
  end if;

  select count(*) into v_position_count from public.positions where election_id = v_voter.election_id;
  select count(*), count(distinct pilihan.position_id)
  into v_choice_count, v_valid_choice_count
  from jsonb_to_recordset(p_pilihan) as pilihan(position_id uuid, candidate_id uuid);

  if v_choice_count <> v_position_count or v_choice_count <> v_valid_choice_count then
    return jsonb_build_object('ok', false, 'reason', 'pilihan_tidak_lengkap');
  end if;

  select count(*) into v_valid_choice_count
  from jsonb_to_recordset(p_pilihan) as pilihan(position_id uuid, candidate_id uuid)
  join public.positions p on p.id = pilihan.position_id and p.election_id = v_voter.election_id
  join public.candidates c on c.id = pilihan.candidate_id and c.position_id = p.id;

  if v_valid_choice_count <> v_position_count then
    return jsonb_build_object('ok', false, 'reason', 'kandidat_tidak_valid');
  end if;

  insert into public.votes (election_id, position_id, candidate_id)
  select v_voter.election_id, pilihan.position_id, pilihan.candidate_id
  from jsonb_to_recordset(p_pilihan) as pilihan(position_id uuid, candidate_id uuid);

  update public.voters set has_voted = true, voted_at = now() where id = v_voter.id;
  perform public.write_voting_audit('vote_berhasil', p_kode, v_voter.election_id);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.code_fingerprint(text) from public;
revoke all on function public.write_voting_audit(text, text, uuid) from public;
revoke all on function public.verify_code(text) from public;
revoke all on function public.cast_vote(text, jsonb) from public;
grant execute on function public.verify_code(text) to anon, authenticated;
grant execute on function public.cast_vote(text, jsonb) to anon, authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261109091000_phase_3.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Apply after phase 1. All management writes are audited in the same transaction.
alter table public.positions drop constraint positions_election_id_urutan_key;
alter table public.positions add constraint positions_election_id_urutan_key unique(election_id,urutan) deferrable initially deferred;
create function public.guard_election_content() returns trigger language plpgsql set search_path = '' as $$
declare eid uuid; state public.election_status;
begin
  if tg_table_name = 'positions' then
    eid := case when tg_op='DELETE' then old.election_id else new.election_id end;
    if tg_op='UPDATE' and new.election_id<>old.election_id then raise exception 'Tidak dapat memindahkan jabatan'; end if;
  else
    if tg_op='UPDATE' and new.position_id<>old.position_id then raise exception 'Tidak dapat memindahkan kandidat'; end if;
    select election_id into eid from public.positions where id=case when tg_op='DELETE' then old.position_id else new.position_id end;
  end if;
  select status into state from public.elections where id=eid for update;
  if state in ('open','closed') then raise exception 'Jabatan dan kandidat hanya dapat diubah pada Draft'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger guard_positions before insert or update or delete on public.positions for each row execute function public.guard_election_content();
create trigger guard_candidates before insert or update or delete on public.candidates for each row execute function public.guard_election_content();
create function public.guard_election_status() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'Hanya Draft dapat dihapus'; end if;
    return old;
  end if;
  if new.status<>old.status then
    if not ((old.status='draft' and new.status='open') or (old.status='open' and new.status='closed')) then raise exception 'Urutan status harus Draft → Open → Closed'; end if;
    if new.status='open' and (not exists(select 1 from public.positions where election_id=new.id) or exists(select 1 from public.positions p where p.election_id=new.id and not exists(select 1 from public.candidates c where c.position_id=p.id))) then raise exception 'Isi jabatan dan kandidat sebelum membuka pemilu'; end if;
  end if;
  return new;
end $$;
create trigger guard_elections before update or delete on public.elections for each row execute function public.guard_election_status();
create function public.audit_management() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(aksi,aktor,detail) values(lower(tg_table_name||'_'||tg_op),coalesce(auth.uid()::text,'sistem'),jsonb_build_object('id',case when tg_op='DELETE' then old.id else new.id end));
  return null;
end $$;
create trigger audit_elections after insert or update or delete on public.elections for each row execute function public.audit_management();
create trigger audit_positions after insert or update or delete on public.positions for each row execute function public.audit_management();
create trigger audit_candidates after insert or update or delete on public.candidates for each row execute function public.audit_management();
create function public.reorder_positions(p_election uuid,p_ids uuid[]) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Akses ditolak'; end if;
  perform 1 from public.elections where id=p_election for update;
  if cardinality(p_ids)<>(select count(*) from public.positions where election_id=p_election) or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) or exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.positions where id=x and election_id=p_election)) then raise exception 'Daftar jabatan tidak sesuai'; end if;
  update public.positions p set urutan=x.ord from unnest(p_ids) with ordinality x(id,ord) where p.id=x.id and p.election_id=p_election;
end $$;
revoke all on function public.reorder_positions(uuid,uuid[]) from public;
grant execute on function public.reorder_positions(uuid,uuid[]) to authenticated;
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('candidate-photos','candidate-photos',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
  end if;
end $$;
-- Writes use a server-only client after checking the admin session.

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261109092000_phase_4_dpt.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Server Actions authenticate the operator before calling this service-only RPC.
create function public.manage_voter(p_actor uuid,p_election uuid,p_action text,p_id uuid default null,p_data jsonb default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.voters%rowtype; state public.election_status; result_id uuid;
begin
  if not exists(select 1 from public.admins where id=p_actor) then raise exception 'Akses ditolak'; end if;
  if p_action not in ('create','edit','delete','reset') then raise exception 'Aksi tidak valid'; end if;
  if p_action<>'create' then
    select * into v from public.voters where id=p_id and election_id=p_election for update;
    if not found then raise exception 'Pemilih tidak ditemukan'; end if;
    if v.has_voted then raise exception 'Pemilih sudah memilih; perubahan ditolak'; end if;
  end if;
  select status into state from public.elections where id=p_election for share;
  if not found then raise exception 'Pemilu tidak ditemukan'; end if;
  if state='closed' then raise exception 'Pemilu sudah ditutup'; end if;
  if p_action in ('create','edit') and (coalesce(length(trim(p_data->>'nama')),0) not between 2 and 160 or coalesce(length(p_data->>'kelompok'),0)>120) then raise exception 'Data pemilih tidak valid'; end if;
  if p_action in ('create','reset') and coalesce(p_data->>'kode','') !~ '^[A-Z0-9]{6,64}$' then raise exception 'Kode tidak valid'; end if;
  if p_action='create' then
    insert into public.voters(election_id,nama,kelompok,kode_unik) values(p_election,p_data->>'nama',nullif(p_data->>'kelompok',''),p_data->>'kode') returning id into result_id;
  elsif p_action='edit' then
    update public.voters set nama=p_data->>'nama',kelompok=nullif(p_data->>'kelompok','') where id=p_id;
    result_id:=p_id;
  elsif p_action='delete' then
    delete from public.voters where id=p_id;
    result_id:=p_id;
  else
    update public.voters set kode_unik=p_data->>'kode' where id=p_id;
    result_id:=p_id;
  end if;
  insert into public.audit_logs(aksi,aktor,detail) values('dpt_'||p_action,p_actor::text,jsonb_build_object('voter_id',result_id,'election_id',p_election));
  return result_id;
end $$;
revoke all on function public.manage_voter(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.manage_voter(uuid,uuid,text,uuid,jsonb) to service_role;
-- Prevent browser clients from bypassing the audited management RPC.
drop policy "admin manage voters" on public.voters;
create policy "admin read voters" on public.voters for select to authenticated using(public.is_admin());
insert into public.settings(key,value) values('kode_unik','{"panjang":12,"format":"alphanumeric"}') on conflict(key) do nothing;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261109093000_phase_5_booth.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- (nested begin omitted)
create table public.voting_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  voter_id uuid not null references public.voters(id) on delete cascade,
  election_id uuid not null references public.elections(id) on delete cascade,
  booth_id uuid references public.booths(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default clock_timestamp(),
  last_activity timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp()+interval '10 minutes'),
  state text not null default 'active' check(state in ('active','submitted','revoked'))
);
create index voting_sessions_expiry on public.voting_sessions(expires_at);
alter table public.voting_sessions enable row level security;
revoke all on public.voting_sessions from anon,authenticated;
create table public.booth_rate_limits (
  key text primary key,
  starts_at timestamptz not null,
  attempts integer not null
);
alter table public.booth_rate_limits enable row level security;
revoke all on public.booth_rate_limits from anon,authenticated;
create index booth_rate_expiry on public.booth_rate_limits(starts_at);

create function public.booth_attempt(p_device text,p_ip text) returns integer
language plpgsql security definer set search_path='' as $$
declare k text; n integer; started timestamptz; wait_seconds integer:=0; cap integer;
begin
  if p_device !~ '^[a-f0-9]{64}$' or p_ip !~ '^[a-f0-9]{64}$' or p_device is null or p_ip is null then raise exception 'Invalid limiter key'; end if;
  delete from public.booth_rate_limits where key in (select key from public.booth_rate_limits where starts_at<clock_timestamp()-interval '10 minutes' limit 100);
  delete from public.voting_sessions where token_hash in (select token_hash from public.voting_sessions where expires_at<clock_timestamp()-interval '1 hour' limit 100);
  -- Same lock order for every request, including shared IPs.
  foreach k in array array['device:'||p_device,'ip:'||p_ip] loop
    cap:=case when k like 'device:%' then 10 else 60 end;
    insert into public.booth_rate_limits as r(key,starts_at,attempts)
    values(k,clock_timestamp(),1)
    on conflict(key) do update set
      starts_at=case when r.starts_at<=clock_timestamp()-interval '1 minute' then clock_timestamp() else r.starts_at end,
      attempts=case when r.starts_at<=clock_timestamp()-interval '1 minute' then 1 else least(r.attempts+1,100000) end
    returning attempts,starts_at into n,started;
    if n>cap then wait_seconds:=greatest(wait_seconds,ceil(extract(epoch from started+interval '1 minute'-clock_timestamp()))::integer,1); end if;
  end loop;
  return wait_seconds;
end $$;

create or replace function public.cast_vote(p_kode text,p_pilihan jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v public.voters%rowtype; state public.election_status; total integer; valid integer; unique_positions integer;
begin
  if p_kode is null or length(trim(p_kode)) not between 6 and 64 then return '{"ok":false,"reason":"kode_tidak_valid"}'; end if;
  if jsonb_typeof(p_pilihan) is distinct from 'array' then return '{"ok":false,"reason":"pilihan_tidak_valid"}'; end if;
  if jsonb_array_length(p_pilihan) not between 1 and 100 then return '{"ok":false,"reason":"pilihan_tidak_valid"}'; end if;
  begin
    select count(*),count(distinct x.position_id) into valid,unique_positions
    from jsonb_to_recordset(p_pilihan) x(position_id uuid,candidate_id uuid);
  exception when invalid_text_representation or invalid_parameter_value then
    return '{"ok":false,"reason":"pilihan_tidak_valid"}';
  end;
  select * into v from public.voters where kode_unik=upper(trim(p_kode)) for update;
  if not found then return '{"ok":false,"reason":"kode_tidak_ditemukan"}'; end if;
  if v.has_voted then
    perform public.write_voting_audit('vote_ditolak_kode_sudah_digunakan',p_kode,v.election_id);
    return '{"ok":false,"reason":"kode_sudah_digunakan"}';
  end if;
  select status into state from public.elections where id=v.election_id for share;
  if state is distinct from 'open' then return '{"ok":false,"reason":"pemilu_belum_dibuka"}'; end if;
  select count(*) into total from public.positions where election_id=v.election_id;
  if total=0 or valid<>total or unique_positions<>total then return '{"ok":false,"reason":"pilihan_tidak_lengkap"}'; end if;
  select count(*) into valid from jsonb_to_recordset(p_pilihan) x(position_id uuid,candidate_id uuid)
    join public.positions p on p.id=x.position_id and p.election_id=v.election_id
    join public.candidates c on c.id=x.candidate_id and c.position_id=p.id;
  if valid<>total then return '{"ok":false,"reason":"kandidat_tidak_valid"}'; end if;
  insert into public.votes(election_id,position_id,candidate_id)
    select v.election_id,x.position_id,x.candidate_id from jsonb_to_recordset(p_pilihan) x(position_id uuid,candidate_id uuid);
  update public.voters set has_voted=true,voted_at=clock_timestamp() where id=v.id;
  perform public.write_voting_audit('vote_berhasil',p_kode,v.election_id);
  return '{"ok":true}';
end $$;

create function public.start_voting_session(p_hash text,p_code text,p_booth uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.voters%rowtype; b public.booths%rowtype; verified jsonb;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid token hash'; end if;
  select * into v from public.voters where kode_unik=upper(trim(p_code)) for update;
  if not found then return '{"ok":false,"reason":"kode_tidak_ditemukan"}'; end if;
  perform 1 from public.elections where id=v.election_id for share;
  if p_booth is not null then
    select * into b from public.booths where id=p_booth for share;
    if not found or b.status='nonaktif' then return '{"ok":false,"reason":"bilik_tidak_valid"}'; end if;
    if b.election_id<>v.election_id then return '{"ok":false,"reason":"kode_tidak_ditemukan"}'; end if;
  end if;
  verified:=public.verify_code(p_code);
  if not (verified->>'valid')::boolean then return jsonb_build_object('ok',false,'reason',verified->>'reason'); end if;
  insert into public.voting_sessions(token_hash,voter_id,election_id,booth_id,code_hash)
    values(p_hash,v.id,v.election_id,p_booth,public.code_fingerprint(v.kode_unik));
  return '{"ok":true}';
end $$;

create function public.use_voting_session(p_hash text,p_action text,p_choices jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.voting_sessions%rowtype; v public.voters%rowtype; e public.elections%rowtype; result jsonb; ballot jsonb; b public.booths%rowtype;
begin
  if p_action not in ('read','touch','cast','leave') or p_action is null then raise exception 'Invalid action'; end if;
  select * into s from public.voting_sessions where token_hash=p_hash for update;
  if not found then return '{"ok":false,"reason":"sesi_berakhir"}'; end if;
  if p_action='leave' then
    update public.voting_sessions set state='revoked' where token_hash=p_hash;
    return '{"ok":true,"state":"left"}';
  end if;
  if s.state='revoked' or s.expires_at<=clock_timestamp() then return '{"ok":false,"reason":"sesi_berakhir"}'; end if;
  -- Idempotent acknowledgement, including a retry after a lost HTTP response.
  if s.state='submitted' then return '{"ok":true,"state":"submitted"}'; end if;
  if s.last_activity<=clock_timestamp()-interval '2 minutes' then
    update public.voting_sessions set state='revoked' where token_hash=p_hash;
    return '{"ok":false,"reason":"sesi_berakhir"}';
  end if;
  -- Same voter -> election ordering as manage_voter and cast_vote.
  select * into v from public.voters where id=s.voter_id for update;
  if not found or public.code_fingerprint(v.kode_unik)<>s.code_hash then
    update public.voting_sessions set state='revoked' where token_hash=p_hash;
    return '{"ok":false,"reason":"sesi_berakhir"}';
  end if;
  if v.has_voted then
    perform public.write_voting_audit('kode_ditolak_sudah_digunakan',v.kode_unik,v.election_id);
    update public.voting_sessions set state='revoked' where token_hash=p_hash;
    return '{"ok":false,"reason":"kode_sudah_digunakan"}';
  end if;
  select * into e from public.elections where id=s.election_id for share;
  if e.status is distinct from 'open' then
    update public.voting_sessions set state='revoked' where token_hash=p_hash;
    return '{"ok":false,"reason":"pemilu_belum_dibuka"}';
  end if;
  if s.booth_id is not null then
    select * into b from public.booths where id=s.booth_id for share;
    if not found or b.status='nonaktif' or b.election_id<>e.id then
      update public.voting_sessions set state='revoked' where token_hash=p_hash;
      return '{"ok":false,"reason":"bilik_tidak_valid"}';
    end if;
  end if;
  if p_action='cast' then
    result:=public.cast_vote(v.kode_unik,p_choices);
    if (result->>'ok')::boolean then
      update public.voting_sessions set state='submitted' where token_hash=p_hash;
      return '{"ok":true,"state":"submitted"}';
    end if;
    return result;
  end if;
  if p_action='touch' then
    update public.voting_sessions set last_activity=clock_timestamp() where token_hash=p_hash returning last_activity into s.last_activity;
  end if;
  select jsonb_agg(jsonb_build_object('id',p.id,'nama',p.nama_jabatan,'candidates',
    (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'nama',c.nama,'nomor',c.no_urut,'foto',c.foto,'info',c.info,'visi_misi',c.visi_misi) order by c.no_urut),'[]') from public.candidates c where c.position_id=p.id)) order by p.urutan)
    into ballot from public.positions p where p.election_id=e.id;
  if ballot is null or exists(select 1 from public.positions p where p.election_id=e.id and not exists(select 1 from public.candidates c where c.position_id=p.id)) then
    return '{"ok":false,"reason":"surat_suara_tidak_tersedia"}';
  end if;
  return jsonb_build_object('ok',true,'state','active','electionName',e.nama,'boothId',s.booth_id,
    'positions',ballot,'remainingMs',greatest(0,floor(extract(epoch from least(s.expires_at,s.last_activity+interval '2 minutes')-clock_timestamp())*1000)));
end $$;

revoke all on function public.verify_code(text),public.cast_vote(text,jsonb) from public,anon,authenticated;
revoke all on function public.booth_attempt(text,text),public.start_voting_session(text,text,uuid),public.use_voting_session(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.verify_code(text),public.cast_vote(text,jsonb),public.booth_attempt(text,text),public.start_voting_session(text,text,uuid),public.use_voting_session(text,text,jsonb) to service_role;
-- (nested commit omitted)

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261109094000_phase_6_results.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- (nested begin omitted)
create or replace view public.candidate_vote_counts as
select
  c.id as candidate_id,
  c.position_id,
  p.election_id,
  c.no_urut,
  c.nama,
  c.foto,
  c.info,
  c.visi_misi,
  coalesce(count(v.id), 0)::integer as vote_count
from public.candidates c
join public.positions p on p.id = c.position_id
left join public.votes v on v.candidate_id = c.id
group by c.id, c.position_id, p.election_id, c.no_urut, c.nama, c.foto, c.info, c.visi_misi;

create or replace function public.get_election_results(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_election public.elections%rowtype;
  v_total_dpt integer;
  v_total_voted integer;
  v_participation numeric;
  v_positions jsonb;
  v_reconciliation_ok boolean := true;
  v_total_votes_all integer := 0;
  v_mismatch_count integer := 0;
begin
  if p_election_id is null then
    return jsonb_build_object('ok', false, 'reason', 'pemilu_tidak_ditemukan');
  end if;

  select * into v_election
  from public.elections
  where id = p_election_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'pemilu_tidak_ditemukan');
  end if;

  -- Hitung partisipasi pemilih
  select count(*), coalesce(count(*) filter (where has_voted = true), 0)
  into v_total_dpt, v_total_voted
  from public.voters
  where election_id = v_election.id;

  if v_total_dpt > 0 then
    v_participation := round((v_total_voted::numeric / v_total_dpt::numeric) * 100, 1);
  else
    v_participation := 0.0;
  end if;

  -- Total semua suara yang masuk di pemilu ini
  select count(*) into v_total_votes_all
  from public.votes
  where election_id = v_election.id;

  -- Cek integritas rekonsiliasi:
  -- Setiap jabatan dalam pemilu harus memiliki total suara tepat sama dengan v_total_voted
  select count(*) into v_mismatch_count
  from public.positions p
  where p.election_id = v_election.id
    and (select count(*) from public.votes v where v.position_id = p.id) <> v_total_voted;

  if v_mismatch_count > 0 then
    v_reconciliation_ok := false;
  else
    v_reconciliation_ok := true;
  end if;

  -- Agregasi suara kandidat dan jabatan
  with position_tallies as (
    select
      p.id as position_id,
      p.nama_jabatan,
      p.urutan,
      coalesce((select count(*) from public.votes v where v.position_id = p.id), 0)::integer as pos_total_votes
    from public.positions p
    where p.election_id = v_election.id
    order by p.urutan asc
  ),
  candidate_tallies as (
    select
      c.id as candidate_id,
      c.position_id,
      c.no_urut,
      c.nama,
      c.foto,
      c.info,
      c.visi_misi,
      coalesce(count(v.id), 0)::integer as votes,
      max(count(v.id)) over (partition by c.position_id)::integer as max_votes
    from public.candidates c
    left join public.votes v on v.candidate_id = c.id
    where exists (select 1 from public.positions p where p.id = c.position_id and p.election_id = v_election.id)
    group by c.id, c.position_id, c.no_urut, c.nama, c.foto, c.info, c.visi_misi
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pt.position_id,
      'nama', pt.nama_jabatan,
      'urutan', pt.urutan,
      'total_votes', pt.pos_total_votes,
      'candidates', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', ct.candidate_id,
            'nomor', ct.no_urut,
            'nama', ct.nama,
            'foto', ct.foto,
            'info', ct.info,
            'visi_misi', ct.visi_misi,
            'votes', ct.votes,
            'percentage', case when pt.pos_total_votes > 0 then round((ct.votes::numeric / pt.pos_total_votes::numeric) * 100, 1) else 0.0 end,
            'is_highest', (ct.votes > 0 and ct.votes = ct.max_votes)
          ) order by ct.no_urut asc
        )
        from candidate_tallies ct
        where ct.position_id = pt.position_id
      ), '[]'::jsonb)
    ) order by pt.urutan asc
  ), '[]'::jsonb) into v_positions
  from position_tallies pt;

  return jsonb_build_object(
    'ok', true,
    'election', jsonb_build_object(
      'id', v_election.id,
      'nama', v_election.nama,
      'status', v_election.status,
      'periode_mulai', v_election.periode_mulai,
      'periode_selesai', v_election.periode_selesai
    ),
    'positions', v_positions,
    'summary', jsonb_build_object(
      'total_dpt', v_total_dpt,
      'total_voted', v_total_voted,
      'participation_percentage', v_participation,
      'reconciliation_ok', v_reconciliation_ok,
      'total_votes_cast', v_total_votes_all,
      'is_final', (v_election.status = 'closed'),
      'last_updated', clock_timestamp()
    )
  );
end;
$$;

revoke all on function public.get_election_results(uuid) from public, anon, authenticated;
grant execute on function public.get_election_results(uuid) to anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'elections') then
      alter publication supabase_realtime add table public.elections;
    end if;
  end if;
end $$;
-- (nested commit omitted)

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- MIGRATION: 20261109095000_phase_7_settings_and_staff.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- (nested begin omitted)
-- Prerequisite tables (idempotent guard in case Phase 5 was not run prior)
create table if not exists public.voting_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  voter_id uuid not null references public.voters(id) on delete cascade,
  election_id uuid not null references public.elections(id) on delete cascade,
  booth_id uuid references public.booths(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default clock_timestamp(),
  last_activity timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp()+interval '10 minutes'),
  state text not null default 'active' check(state in ('active','submitted','revoked'))
);
create index if not exists voting_sessions_expiry on public.voting_sessions(expires_at);
alter table public.voting_sessions enable row level security;
revoke all on public.voting_sessions from anon,authenticated;

create table if not exists public.booth_rate_limits (
  key text primary key,
  starts_at timestamptz not null,
  attempts integer not null
);
alter table public.booth_rate_limits enable row level security;
revoke all on public.booth_rate_limits from anon,authenticated;
create index if not exists booth_rate_expiry on public.booth_rate_limits(starts_at);

-- 1. Automate booth status in start_voting_session and use_voting_session
create or replace function public.start_voting_session(p_hash text, p_code text, p_booth uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.voters%rowtype;
  b public.booths%rowtype;
  verified jsonb;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid token hash'; end if;
  select * into v from public.voters where kode_unik = upper(trim(p_code)) for update;
  if not found then return '{"ok":false,"reason":"kode_tidak_ditemukan"}'; end if;
  perform 1 from public.elections where id = v.election_id for share;
  if p_booth is not null then
    select * into b from public.booths where id = p_booth for update;
    if not found or b.status = 'nonaktif' then return '{"ok":false,"reason":"bilik_tidak_valid"}'; end if;
    if b.election_id <> v.election_id then return '{"ok":false,"reason":"kode_tidak_ditemukan"}'; end if;
    -- Mark booth as in use
    update public.booths set status = 'terpakai' where id = p_booth;
  end if;
  verified := public.verify_code(p_code);
  if not (verified->>'valid')::boolean then return jsonb_build_object('ok', false, 'reason', verified->>'reason'); end if;
  insert into public.voting_sessions(token_hash, voter_id, election_id, booth_id, code_hash)
    values(p_hash, v.id, v.election_id, p_booth, public.code_fingerprint(v.kode_unik));
  return '{"ok":true}';
end $$;

create or replace function public.use_voting_session(p_hash text, p_action text, p_choices jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.voting_sessions%rowtype;
  v public.voters%rowtype;
  e public.elections%rowtype;
  result jsonb;
  ballot jsonb;
  b public.booths%rowtype;
begin
  if p_action not in ('read', 'touch', 'cast', 'leave') or p_action is null then raise exception 'Invalid action'; end if;
  select * into s from public.voting_sessions where token_hash = p_hash for update;
  if not found then return '{"ok":false,"reason":"sesi_berakhir"}'; end if;
  if p_action = 'leave' then
    update public.voting_sessions set state = 'revoked' where token_hash = p_hash;
    if s.booth_id is not null then
      update public.booths set status = 'kosong' where id = s.booth_id and status = 'terpakai';
    end if;
    return '{"ok":true,"state":"left"}';
  end if;
  if s.state = 'revoked' or s.expires_at <= clock_timestamp() then return '{"ok":false,"reason":"sesi_berakhir"}'; end if;
  if s.state = 'submitted' then return '{"ok":true,"state":"submitted"}'; end if;
  if s.last_activity <= clock_timestamp() - interval '2 minutes' then
    update public.voting_sessions set state = 'revoked' where token_hash = p_hash;
    if s.booth_id is not null then
      update public.booths set status = 'kosong' where id = s.booth_id and status = 'terpakai';
    end if;
    return '{"ok":false,"reason":"sesi_berakhir"}';
  end if;
  select * into v from public.voters where id = s.voter_id for update;
  if not found or public.code_fingerprint(v.kode_unik) <> s.code_hash then
    update public.voting_sessions set state = 'revoked' where token_hash = p_hash;
    if s.booth_id is not null then
      update public.booths set status = 'kosong' where id = s.booth_id and status = 'terpakai';
    end if;
    return '{"ok":false,"reason":"sesi_berakhir"}';
  end if;
  if v.has_voted then
    perform public.write_voting_audit('kode_ditolak_sudah_digunakan', v.kode_unik, v.election_id);
    update public.voting_sessions set state = 'revoked' where token_hash = p_hash;
    if s.booth_id is not null then
      update public.booths set status = 'kosong' where id = s.booth_id and status = 'terpakai';
    end if;
    return '{"ok":false,"reason":"kode_sudah_digunakan"}';
  end if;
  select * into e from public.elections where id = s.election_id for share;
  if e.status is distinct from 'open' then
    update public.voting_sessions set state = 'revoked' where token_hash = p_hash;
    if s.booth_id is not null then
      update public.booths set status = 'kosong' where id = s.booth_id and status = 'terpakai';
    end if;
    return '{"ok":false,"reason":"pemilu_belum_dibuka"}';
  end if;
  if s.booth_id is not null then
    select * into b from public.booths where id = s.booth_id for share;
    if not found or b.status = 'nonaktif' or b.election_id <> e.id then
      update public.voting_sessions set state = 'revoked' where token_hash = p_hash;
      update public.booths set status = 'kosong' where id = s.booth_id and status = 'terpakai';
      return '{"ok":false,"reason":"bilik_tidak_valid"}';
    end if;
  end if;
  if p_action = 'cast' then
    result := public.cast_vote(v.kode_unik, p_choices);
    if (result->>'ok')::boolean then
      update public.voting_sessions set state = 'submitted' where token_hash = p_hash;
      if s.booth_id is not null then
        update public.booths set status = 'kosong' where id = s.booth_id and status = 'terpakai';
      end if;
      return '{"ok":true,"state":"submitted"}';
    end if;
    return result;
  end if;
  if p_action = 'touch' then
    update public.voting_sessions set last_activity = clock_timestamp() where token_hash = p_hash returning last_activity into s.last_activity;
  end if;
  select jsonb_agg(jsonb_build_object('id', p.id, 'nama', p.nama_jabatan, 'candidates',
    (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nama', c.nama, 'nomor', c.no_urut, 'foto', c.foto, 'info', c.info, 'visi_misi', c.visi_misi) order by c.no_urut), '[]') from public.candidates c where c.position_id = p.id)) order by p.urutan)
    into ballot from public.positions p where p.election_id = e.id;
  if ballot is null or exists(select 1 from public.positions p where p.election_id = e.id and not exists(select 1 from public.candidates c where c.position_id = p.id)) then
    return '{"ok":false,"reason":"surat_suara_tidak_tersedia"}';
  end if;
  return jsonb_build_object('ok', true, 'state', 'active', 'electionName', e.nama, 'boothId', s.booth_id,
    'positions', ballot, 'remainingMs', greatest(0, floor(extract(epoch from least(s.expires_at, s.last_activity + interval '2 minutes') - clock_timestamp()) * 1000)));
end $$;

-- 2. Web settings helper RPCs
create or replace function public.get_web_settings()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb;
begin
  select value into v_settings from public.settings where key = 'web_settings';
  if v_settings is null then
    v_settings := jsonb_build_object(
      'nama_penyelenggara', 'Panitia Pemilihan Umum',
      'logo_url', null,
      'tema', 'system',
      'format_kode_prefix', 'PEMILU-',
      'format_kode_length', 6,
      'tampilkan_hasil_live', true
    );
  end if;
  return v_settings;
end;
$$;

create or replace function public.save_web_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nama text;
  v_theme text;
  v_prefix text;
  v_len integer;
  v_live boolean;
  v_logo text;
  v_final jsonb;
  v_actor text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'akses_ditolak');
  end if;

  v_nama := coalesce(nullif(trim(p_settings->>'nama_penyelenggara'), ''), 'Panitia Pemilihan Umum');
  v_logo := nullif(trim(p_settings->>'logo_url'), '');
  v_theme := coalesce(nullif(trim(p_settings->>'tema'), ''), 'system');
  v_prefix := coalesce(nullif(trim(p_settings->>'format_kode_prefix'), ''), 'PEMILU-');
  v_len := coalesce((p_settings->>'format_kode_length')::integer, 6);
  v_live := coalesce((p_settings->>'tampilkan_hasil_live')::boolean, true);

  v_final := jsonb_build_object(
    'nama_penyelenggara', v_nama,
    'logo_url', v_logo,
    'tema', v_theme,
    'format_kode_prefix', v_prefix,
    'format_kode_length', v_len,
    'tampilkan_hasil_live', v_live
  );

  insert into public.settings(key, value, updated_at)
  values ('web_settings', v_final, clock_timestamp())
  on conflict (key) do update
  set value = excluded.value, updated_at = clock_timestamp();

  select email into v_actor from public.admins where id = auth.uid();

  insert into public.audit_logs(aksi, aktor, detail)
  values (
    'ubah_pengaturan_web',
    coalesce(v_actor, 'admin'),
    jsonb_build_object('pengaturan', v_final)
  );

  return jsonb_build_object('ok', true, 'settings', v_final);
end;
$$;

revoke all on function public.get_web_settings() from public, anon, authenticated;
grant execute on function public.get_web_settings() to anon, authenticated, service_role;

revoke all on function public.save_web_settings(jsonb) from public, anon, authenticated;
grant execute on function public.save_web_settings(jsonb) to authenticated, service_role;

-- 3. Register booths and settings in supabase_realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'booths') then
      alter publication supabase_realtime add table public.booths;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'settings') then
      alter publication supabase_realtime add table public.settings;
    end if;
  end if;
end $$;
-- (nested commit omitted)

-- ==============================================================================
-- FINAL COMMIT
-- ==============================================================================
commit;
