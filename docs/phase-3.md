# Pengelolaan pemilu dan kandidat

Jalankan hanya migrasi baru `supabase/migrations/20261109091000_phase_3.sql` setelah migrasi Fase 1. Migrasi menambahkan bucket publik candidate-photos (maksimal 5 MB; JPEG/PNG/WebP), trigger audit atomik, guard perubahan, serta RPC pengurutan.

Masuk sebagai admin. Di Kelola Pemilu buat Draft, atur periode (WIB), pilih pemilu, tambahkan jabatan. Nomor urut wajib unik. Gunakan pegangan ↕ untuk drag-and-drop; keyboard: Space, panah, Space. Di Kandidat pilih jabatan lalu tambah nama, nomor urut, info, visi/misi dan foto.

Pembukaan membutuhkan setidaknya satu jabatan dan kandidat pada setiap jabatan. Status berjalan Draft → Open → Closed dengan konfirmasi. Hanya Draft dapat dihapus atau diubah susunan jabatan/kandidatnya. Closed tetap terkunci untuk menjaga riwayat.

Semua mutasi aplikasi lewat Server Action yang memeriksa sesi dan tabel admins serta Zod. Audit mutasi tabel ditulis oleh trigger dalam transaksi yang sama. Upload memakai client server-only; file baru dibersihkan jika penyimpanan kandidat gagal. Foto lama dipertahankan di Storage untuk menghindari pemutusan referensi; pembersihan orphan belum otomatis.

Jalankan `supabase/tests/phase_3.sql` pada database uji; skrip rollback. Uji manual: CRUD setiap entitas, nomor duplikat, urutan drag/keyboard setelah refresh, tanggal tidak valid, foto >5 MB, unggah foto, konfirmasi/batal status, penolakan perubahan saat Open, akses Server Action tanpa sesi, dan audit_logs setelah tiap mutasi. Migrasi dan tes SQL belum dijalankan ke database remote oleh agent.
