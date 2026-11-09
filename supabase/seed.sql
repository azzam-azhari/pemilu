-- Development-only seed. It intentionally does not create an auth user/admin.
-- Create that user in Supabase Auth, then insert the matching UUID into public.admins.
with election as (
  insert into public.elections (nama, periode_mulai, periode_selesai, status)
  values ('Pemilihan Ketua Organisasi 2026', now(), now() + interval '1 day', 'draft')
  returning id
), positions as (
  insert into public.positions (election_id, nama_jabatan, urutan)
  select id, nama, urutan
  from election cross join (values ('Ketua Umum', 1), ('Wakil Ketua Umum', 2)) as data(nama, urutan)
  returning id, nama_jabatan
), candidates as (
  insert into public.candidates (position_id, no_urut, nama, info, visi_misi)
  select p.id, data.no_urut, data.nama, data.info, data.visi_misi
  from positions p
  join lateral (
    select * from (values
      (1, 'Alya Pratama', 'Kandidat dengan fokus kolaborasi.', 'Membangun organisasi yang inklusif.'),
      (2, 'Bima Santosa', 'Kandidat dengan fokus transparansi.', 'Mewujudkan program yang terukur.'),
      (3, 'Citra Lestari', 'Kandidat dengan fokus pelayanan.', 'Memperkuat ruang aspirasi anggota.')
    ) as kandidat(no_urut, nama, info, visi_misi)
  ) as data on true
  returning id
)
insert into public.voters (election_id, kode_unik, nama, kelompok)
select election.id, 'PEMILU-' || lpad(n::text, 3, '0'), 'Pemilih Contoh ' || n, case when n <= 10 then 'Kelompok A' else 'Kelompok B' end
from election cross join generate_series(1, 20) as n;
