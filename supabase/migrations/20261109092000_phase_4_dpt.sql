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
