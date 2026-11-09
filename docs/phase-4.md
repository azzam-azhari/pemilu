# Data DPT

Terapkan migrasi `supabase/migrations/20261109092000_phase_4_dpt.sql` setelah Fase 1–3. Jangan jalankan ulang migrasi awal.

Halaman /admin/data mendukung pemilu, pencarian nama, filter kelompok/status, sortir, ukuran halaman dan paginasi di URL. Query dan jumlah baris dihitung di database; ekspor mengambil seluruh DPT pemilu terpilih (bukan hanya halaman/filter).

CSV UTF-8 menggunakan header persis `nama,kelompok`. Maksimal 2 MB dan 5.000 baris. Koma/kutip/newline dalam nilai harus dikutip sesuai CSV. Validasi Zod dilakukan di server, baris valid disimpan dan nomor baris fisik yang gagal ditampilkan. Impor tidak melakukan deduplikasi nama karena dua pemilih dapat bernama sama. Jangan impor ulang baris yang sudah berhasil.

Kode otomatis dibuat saat tambah/impor, memakai crypto.randomInt dan constraint unik global; tabrakan diulang maksimal delapan kali. Pengaturan di settings dengan key kode_unik: {"panjang":12,"format":"alphanumeric"}. Pilihan format numeric/alphanumeric, panjang 6–64; UI pengaturan tetap Fase 7.

Reset hanya mengganti kode pemilih yang belum memilih. Kode lama tidak berlaku. Hak pilih yang sudah dipakai tidak dapat direset, diedit, atau dihapus karena suara anonim tidak dapat ditarik kembali. Semua perubahan ditolak pada Closed. Konfirmasi reset/hapus menggunakan dialog browser.

Mutasi dan audit berada dalam RPC service-only yang memeriksa operator, mengunci pemilih, dan mengecek ulang status. Server Action memeriksa sesi admin sebelum memakai service role. Browser admin hanya memperoleh akses SELECT terhadap voters. Ekspor mencatat audit dan menetralkan formula CSV.

Verifikasi lokal: `node --experimental-strip-types --test tests/dpt.test.mjs`, lint, build. Tes SQL `supabase/tests/phase_4.sql` harus dijalankan di database uji; belum dijalankan otomatis pada remote. Uji penerimaan: impor 1.000 pemilih, hitung kode unik, coba kode duplikat, refresh URL filter, pindah halaman, reset kode belum memilih, tolak reset pemilih sudah memilih, ekspor >1.000 baris dan periksa audit.
