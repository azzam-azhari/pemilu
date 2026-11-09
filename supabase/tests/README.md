# Pengujian Fase 1

Jalankan `phase_1_voting.sql` pada proyek Supabase non-produksi melalui SQL Editor setelah migrasi diterapkan. Skrip dibungkus transaksi dan selalu `ROLLBACK`.

Untuk menguji persaingan dua koneksi, jalankan dua panggilan ini sedekat mungkin (misalnya dari dua SQL Editor/browser berbeda) dengan kode dan pilihan yang sama:

```sql
select public.cast_vote('TEST-CONCURRENT-001', '[{"position_id":"...","candidate_id":"..."}]'::jsonb);
```

Hasil yang benar: tepat satu respons `{"ok": true}`, satu lagi memiliki `reason` `kode_sudah_digunakan`, dan hanya satu baris suara baru. Kunci baris `FOR UPDATE` pada `voters` di `cast_vote` menjamin hasil ini.
