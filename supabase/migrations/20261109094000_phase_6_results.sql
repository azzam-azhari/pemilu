begin;

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

commit;

