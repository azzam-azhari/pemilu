# Pengujian Fase 1

Jalankan `phase_1_voting.sql` pada proyek Supabase non-produksi melalui SQL Editor setelah migrasi diterapkan. Skrip dibungkus transaksi dan selalu `ROLLBACK`.

## Sinkronisasi admin dari Auth

Sebelum menerapkan migrasi, buka **Authentication → Providers → Email** pada dashboard Supabase dan nonaktifkan pendaftaran publik. Karena setiap user Auth menjadi admin, akun hanya boleh dibuat operator melalui **Authentication → Users**.

Setelah migrasi diterapkan, buat user email baru di **Authentication → Users**. Baris dengan UUID dan email yang sama harus langsung muncul di `public.admins` pada Table Editor. Untuk nama, isi User Metadata `{"nama":"Nama Admin"}` atau `{"full_name":"Nama Admin"}`; bila keduanya kosong, sistem memakai bagian awal email.

Ubah email atau metadata nama user tersebut lalu pastikan `public.admins` ikut berubah. Hapus user Auth tersebut dan pastikan baris `public.admins` ikut terhapus oleh foreign key `on delete cascade`.

Untuk menguji persaingan dua koneksi, jalankan dua panggilan ini sedekat mungkin (misalnya dari dua SQL Editor/browser berbeda) dengan kode dan pilihan yang sama:

```sql
select public.cast_vote('TEST-CONCURRENT-001', '[{"position_id":"...","candidate_id":"..."}]'::jsonb);
```

Hasil yang benar: tepat satu respons `{"ok": true}`, satu lagi memiliki `reason` `kode_sudah_digunakan`, dan hanya satu baris suara baru. Kunci baris `FOR UPDATE` pada `voters` di `cast_vote` menjamin hasil ini.
