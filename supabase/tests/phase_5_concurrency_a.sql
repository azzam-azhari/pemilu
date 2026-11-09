-- Run immediately after setup on connection A; start B during the sleep.
begin;
select public.use_voting_session(public.code_fingerprint('phase5-session-a'),'cast',
 '[{"position_id":"55555555-5555-4555-8555-555555555502","candidate_id":"55555555-5555-4555-8555-555555555503"}]'::jsonb);
select pg_sleep(10);
commit;
