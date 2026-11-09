begin;
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

create or replace function public.booth_attempt(p_device text,p_ip text) returns integer
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

create or replace function public.start_voting_session(p_hash text,p_code text,p_booth uuid default null)
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

create or replace function public.use_voting_session(p_hash text,p_action text,p_choices jsonb default null)
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
commit;
