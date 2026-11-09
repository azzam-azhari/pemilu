-- Connection B blocks until A commits, then must report kode_sudah_digunakan.
select public.use_voting_session(public.code_fingerprint('phase5-session-b'),'cast',
 '[{"position_id":"55555555-5555-4555-8555-555555555502","candidate_id":"55555555-5555-4555-8555-555555555503"}]'::jsonb);
do $$
begin
  if (select count(*) from public.votes where election_id='55555555-5555-4555-8555-555555555501')<>1 then raise exception 'Concurrent voting inserted duplicate votes'; end if;
  if (select count(*) from public.voters where election_id='55555555-5555-4555-8555-555555555501' and has_voted)<>1 then raise exception 'Voter flag mismatch'; end if;
end $$;
