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
