-- Run only on a test project; every fixture is rolled back.
begin;
do $$
declare a uuid:=gen_random_uuid(); e uuid; v uuid; n integer;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(a,a::text||'@example.test','{}');
  insert into public.elections(nama) values('Uji DPT') returning id into e;
  v:=public.manage_voter(a,e,'create',null,'{"nama":"Pemilih Uji","kelompok":"A","kode":"TESTDPT001"}');
  perform public.manage_voter(a,e,'reset',v,'{"kode":"TESTDPT002"}');
  if not exists(select 1 from public.voters where id=v and kode_unik='TESTDPT002' and not has_voted) then raise exception 'Reset gagal'; end if;
  if not exists(select 1 from public.audit_logs where aksi='dpt_reset' and detail->>'voter_id'=v::text) then raise exception 'Audit reset hilang'; end if;
  begin
    perform public.manage_voter(a,e,'create',null,'{"nama":"Duplikat","kode":"TESTDPT002"}');
    raise exception 'TEST_FAILED';
  exception when unique_violation then null;
  end;
  update public.voters set has_voted=true,voted_at=now() where id=v;
  begin
    perform public.manage_voter(a,e,'reset',v,'{"kode":"TESTDPT003"}');
    raise exception 'TEST_FAILED';
  exception when raise_exception then if sqlerrm='TEST_FAILED' then raise; end if;
  end;
  begin
    perform public.manage_voter(gen_random_uuid(),e,'delete',v);
    raise exception 'TEST_FAILED';
  exception when raise_exception then if sqlerrm='TEST_FAILED' then raise; end if;
  end;
  for n in 1..1000 loop
    perform public.manage_voter(a,e,'create',null,jsonb_build_object('nama','Uji '||n,'kode','BATCH'||lpad(n::text,8,'0')));
  end loop;
  if (select count(distinct kode_unik) from public.voters where election_id=e)<>1001 then raise exception 'Batch tidak lengkap'; end if;
  if has_function_privilege('anon','public.manage_voter(uuid,uuid,text,uuid,jsonb)','execute') or has_function_privilege('authenticated','public.manage_voter(uuid,uuid,text,uuid,jsonb)','execute') then raise exception 'RPC pengelolaan bocor'; end if;
end $$;
rollback;
