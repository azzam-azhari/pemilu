-- Run in a non-production Supabase SQL Editor after the migration.
begin;

do $$
declare
  v_election_id uuid := gen_random_uuid();
  v_position_id uuid := gen_random_uuid();
  v_candidate_id uuid := gen_random_uuid();
  v_second_candidate_id uuid := gen_random_uuid();
  first_result jsonb;
  second_result jsonb;
begin
  insert into public.elections (id, nama, status) values (v_election_id, 'Test atomik', 'open');
  insert into public.positions (id, election_id, nama_jabatan, urutan) values (v_position_id, v_election_id, 'Ketua', 1);
  insert into public.candidates (id, position_id, no_urut, nama) values
    (v_candidate_id, v_position_id, 1, 'Kandidat Satu'),
    (v_second_candidate_id, v_position_id, 2, 'Kandidat Dua');
  insert into public.voters (election_id, kode_unik, nama) values (v_election_id, 'TEST-ATOMIC-001', 'Pemilih Uji');

  first_result := public.cast_vote('TEST-ATOMIC-001', jsonb_build_array(jsonb_build_object('position_id', v_position_id, 'candidate_id', v_candidate_id)));
  second_result := public.cast_vote('TEST-ATOMIC-001', jsonb_build_array(jsonb_build_object('position_id', v_position_id, 'candidate_id', v_second_candidate_id)));

  if first_result <> '{"ok": true}'::jsonb then raise exception 'Pemungutan pertama gagal: %', first_result; end if;
  if second_result->>'reason' <> 'kode_sudah_digunakan' then raise exception 'Kode ganda tidak ditolak: %', second_result; end if;
  if (select count(*) from public.votes where election_id = v_election_id) <> 1 then raise exception 'Jumlah suara bukan satu'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'votes' and column_name = 'voter_id') then raise exception 'votes tidak boleh memiliki voter_id'; end if;

  update public.elections set status = 'closed' where id = v_election_id;
  insert into public.voters (election_id, kode_unik, nama) values (v_election_id, 'TEST-CLOSED-001', 'Pemilih Tertutup');
  if (public.verify_code('TEST-CLOSED-001')->>'reason') <> 'pemilu_belum_dibuka' then raise exception 'Pemilu closed tidak ditolak'; end if;
end;
$$;

rollback;
