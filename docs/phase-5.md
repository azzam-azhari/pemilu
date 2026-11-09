# Bilik suara

## Penerapan

Terapkan migrasi baru `supabase/migrations/20261109093000_phase_5_booth.sql` setelah Fase 1–4. Jangan ulang migrasi lama. Uji di proyek non-produksi dahulu. Migrasi mengubah akses verify_code/cast_vote menjadi service-role saja dan menambahkan sesi serta rate limiter dengan RLS tertutup.

Buka `/bilik` atau `/bilik?bilik=UUID` dari tabel booths. Nama bilik dan pemilu diperiksa di server. Siapkan pemilu Open dengan kandidat per jabatan serta DPT belum memilih. Foto menggunakan URL Storage publik; gambar gagal mempunyai placeholder.

Produksi ditujukan untuk Vercel HTTPS. `VERCEL=1` ditetapkan oleh Vercel; jangan memalsukannya pada server langsung. IP dibaca dari x-forwarded-for yang ditimpa platform (rujukan: https://vercel.com/docs/headers/request-headers), divalidasi sebagai satu alamat, lalu di-HMAC dengan secret server sebelum disimpan. Deployment produksi lain ditolak sampai ada konfigurasi proxy tepercaya. Lokal development memakai satu identitas IP loopback bersama.

Tidak ada env baru. SUPABASE_SERVICE_ROLE_KEY tetap hanya digunakan oleh modul server-only. Cookie sesi dan perangkat httpOnly, SameSite Strict, path /bilik, Secure di produksi. Jangan merekam payload Server Actions berisi kode ke log eksternal.

## Perilaku

- Token sesi acak 32 byte, hanya hash disimpan. Idle 120 detik, umur absolut 600 detik. Peringatan pada 30 detik terakhir. Aktivitas pengguna mengirim heartbeat maksimal sekali/15 detik. Polling lima detik tidak memperpanjang idle.
- Limiter Postgres atomik: 10 percobaan/menit/perangkat dan 60/menit/IP, termasuk format kode salah. Window dimulai pada percobaan pertama; UI menunjukkan waktu tunggu. Cookie perangkat yang dihapus tidak melewati batas IP.
- Semua RPC sensitif hanya service_role. Validasi pilihan berlapis Zod/Postgres. Urutan lock sesi → pemilih → pemilu konsisten dengan pemilih → pemilu di reset DPT. Status pemilu dikunci selama cast agar Close tidak menyela transaksi.
- Commit mencakup votes, has_voted, audit, dan sesi submitted. Retry sesi submitted mengembalikan sukses tanpa memilih ulang. Cookie dipertahankan selama pesan sukses agar retry respons hilang dapat dipulihkan; dicabut saat kembali ke input.
- Pilihan hanya di memori UI. Refresh memuat ulang surat suara tanpa pilihan lama. Keluar, kedaluwarsa, atau sukses membersihkan kode/pilihan/modal. Pesan sukses tampil empat detik lalu pembersihan cookie diselesaikan sebelum pemilih berikutnya.
- Reset kode DPT menggagalkan fingerprint sesi lama. Audit tidak berisi pilihan kandidat, token mentah, atau kode mentah. votes tetap tanpa identitas pemilih. Sesi kedaluwarsa dan limiter lama dibersihkan terbatas pada permintaan verifikasi berikutnya.

## Verifikasi

`node --experimental-strip-types --test tests/booth.test.mjs` menjalankan PostgreSQL terisolasi melalui PGlite (devDependency, bukan backend produksi). Fixture menggantikan pgcrypto digest SHA-256 dengan fungsi SHA-256 inti dan membuat schema/role Auth minimal.

Tes otomatis: normalisasi kode, input pilihan tidak valid, limiter/pergantian window/IP bersama, sesi palsu, idle, umur absolut, logout, reset kode, pembacaan tanpa memperpanjang sesi, rollback ketika audit gagal, dua sesi memakai kode sama secara berurutan, retry idempoten, izin RPC, serta kolom votes anonim. PGlite memakai satu koneksi; tes ini tidak membuktikan konkurensi dua koneksi.

Untuk uji konkurensi nyata, pada database uji kosong jalankan phase_5_concurrency_setup.sql lalu A dan B pada dua koneksi terpisah dalam 120 detik. Jalankan B saat A tidur sepuluh detik. A harus sukses, B ditolak, dan assertion jumlah suara harus lolos. Fixture ini committed dan sengaja tidak dihapus otomatis; gunakan proyek disposable. Uji tambahan: tahan transaksi penutupan pemilu, kirim cast dari koneksi lain, commit penutupan; cast harus ditolak. Jika cast memperoleh lock lebih dahulu, penutupan menunggu commit cast.

Uji browser setelah migrasi: kode salah/terpakai, beda pemilu bilik, modal visi-misi, pilihan lengkap, batal konfirmasi, keyboard/fokus modal, foto gagal, jaringan putus saat submit lalu retry, refresh, keluar, idle dua menit, maksimum sepuluh menit, dan kembali setelah sukses. Jangan lakukan uji voting dengan kode pemilih produksi.

Status verifikasi agent: sebelas tes lokal lulus; halaman awal /bilik terlihat di browser. Tes dua koneksi dan alur voting browser lengkap terhadap Supabase belum dijalankan. Lint tanpa error (satu warning TanStack yang sudah ada). Build produksi berhasil.
