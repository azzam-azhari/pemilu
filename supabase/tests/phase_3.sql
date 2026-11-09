begin;
do $$
declare e uuid; p uuid; c uuid;
begin
  insert into public.elections(nama) values('Uji pengelolaan') returning id into e;
  insert into public.positions(election_id,nama_jabatan,urutan) values(e,'Ketua',1) returning id into p;
  insert into public.candidates(position_id,no_urut,nama) values(p,1,'Kandidat Uji') returning id into c;
  if not exists(select 1 from public.audit_logs where aksi='candidates_insert' and detail->>'id'=c::text) then raise exception 'Audit tidak tercatat'; end if;
  update public.elections set status='open' where id=e;
  begin
    update public.candidates set nama='Diubah' where id=c;
    raise exception 'TEST_FAILED';
  exception when raise_exception then
    if sqlerrm='TEST_FAILED' then raise; end if;
  end;
  begin
    delete from public.positions where id=p;
    raise exception 'TEST_FAILED';
  exception when raise_exception then
    if sqlerrm='TEST_FAILED' then raise; end if;
  end;
  update public.elections set status='closed' where id=e;
  begin
    update public.elections set status='draft' where id=e;
    raise exception 'TEST_FAILED';
  exception when raise_exception then
    if sqlerrm='TEST_FAILED' then raise; end if;
  end;
end $$;
rollback;
