-- TEST PROJECT ONLY. Committed fixtures are required for two separate sessions.
begin;
insert into public.elections(id,nama,status) values('55555555-5555-4555-8555-555555555501','Uji konkurensi Fase 5','draft');
insert into public.positions(id,election_id,nama_jabatan,urutan) values('55555555-5555-4555-8555-555555555502','55555555-5555-4555-8555-555555555501','Ketua',1);
insert into public.candidates(id,position_id,no_urut,nama) values('55555555-5555-4555-8555-555555555503','55555555-5555-4555-8555-555555555502',1,'Kandidat Uji');
insert into public.voters(election_id,kode_unik,nama) values('55555555-5555-4555-8555-555555555501','PHASE5-CONCURRENT','Pemilih Uji');
update public.elections set status='open' where id='55555555-5555-4555-8555-555555555501';
select public.start_voting_session(public.code_fingerprint('phase5-session-a'),'PHASE5-CONCURRENT',null);
select public.start_voting_session(public.code_fingerprint('phase5-session-b'),'PHASE5-CONCURRENT',null);
commit;
