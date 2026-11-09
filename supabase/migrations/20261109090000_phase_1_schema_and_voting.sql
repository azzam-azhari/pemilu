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
