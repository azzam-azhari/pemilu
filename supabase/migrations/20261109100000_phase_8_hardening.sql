-- ==============================================================================
-- FASE 8: QA & HARDENING (SECURITY, RLS POLICIES & CONCURRENCY INTEGRITY)
-- ==============================================================================

begin;

-- 1. Izinkan role anon dan authenticated untuk membaca metadata pemilu (read-only).
-- Metadata pemilu (id, nama, status, periode) bersifat non-sensitif dan wajib dapat dibaca
-- oleh pengunjung halaman /live (proyektor publik) dan pemilih pada bilik suara.
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'elections' and policyname = 'public read elections'
  ) then
    create policy "public read elections" on public.elections
      for select to public
      using (true);
  end if;
end $$;

grant select on public.elections to anon, authenticated;

-- 2. Pastikan tabel votes dan voters benar-benar tertutup dari pembacaan langsung publik / anon.
-- Seluruh penulisan suara wajib melewati cast_vote / use_voting_session (service_role).
-- Seluruh perolehan hasil suara publik wajib melewati get_election_results() RPC.
revoke all on public.votes from anon, authenticated;
grant select on public.votes to authenticated; -- Hanya diproteksi RLS public.is_admin()

revoke all on public.voters from anon;
grant select on public.voters to authenticated; -- Hanya diproteksi RLS public.is_admin()

-- 3. Pastikan tabel audit_logs hanya dapat dibaca oleh admin yang terautentikasi
revoke all on public.audit_logs from anon;
grant select on public.audit_logs to authenticated;

-- 4. Pastikan tabel sesi voting dan rate limiter tertutup total dari akses client
revoke all on public.voting_sessions from anon, authenticated;
revoke all on public.booth_rate_limits from anon, authenticated;

-- 5. Pastikan RPC hasil pemilu get_election_results dapat diakses oleh anon, authenticated, dan service_role
grant execute on function public.get_election_results(uuid) to anon, authenticated, service_role;

-- 6. Pastikan RPC pengaturan web get_web_settings dapat diakses oleh anon, authenticated, dan service_role
grant execute on function public.get_web_settings() to anon, authenticated, service_role;

commit;

