begin;

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

commit;

