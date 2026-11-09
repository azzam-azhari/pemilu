# PRD — Website E-Voting (Pemilihan Ketua Umum)

## 1. Ringkasan

Website pemilihan umum digital yang dapat dipakai untuk **pemilihan ketua apa pun** (organisasi, kelas, komunitas, kampus, dll). Pemilih memberikan suara lewat **kode unik sekali pakai** di bilik suara. Hasil dapat dipantau secara **live** di layar proyektor. Pengelolaan dilakukan lewat **dashboard admin**.

**Tujuan**
- Pemilihan cepat, rahasia, dan tidak bisa dicurangi (1 kode = 1 kali pilih).
- Hasil transparan dan real-time.
- Fleksibel: jumlah jabatan, kandidat, dan pemilih bebas diatur admin.

**Di luar cakupan (v1):** login pemilih, pemilihan dari rumah/online publik, pembayaran, aplikasi mobile native.

---

## 2. Peran Pengguna

| Peran | Akses | Login |
|---|---|---|
| **Admin** | Dashboard penuh | Ya (satu-satunya yang login) |
| **Pemilih** | Halaman bilik suara | Tidak. Cukup memasukkan kode unik |
| **Publik / Penonton** | Halaman Live Preview (read-only) | Tidak |

> Catatan: menu *Kelola Petugas* hanya mencatat data petugas (nama, bilik tugas). Petugas tidak memiliki akun login.

---

## 3. Alur Utama Voting

```
[Halaman Input Kode] → validasi kode → [Halaman Pemilihan] → pilih kandidat
   → [Konfirmasi] → simpan → [Sukses] → otomatis kembali ke [Halaman Input Kode]
```

1. Pemilih membuka halaman bilik (`/bilik`) dan memasukkan **kode unik**.
2. Sistem memvalidasi kode:
   - **Kode salah / tidak ditemukan** → pesan error, tetap di halaman input.
   - **Kode sudah dipakai** → modal "Hak Suara Sudah Digunakan", dicatat di Audit Log.
   - **Pemilu tidak berstatus OPEN** → akses ditolak.
   - **Kode valid & belum dipakai** → masuk halaman pemilihan.
3. Di halaman pemilihan, pemilih memilih **1 kandidat per jabatan**.
4. Tombol "Konfirmasi & Simpan" aktif setelah semua jabatan terpilih. Muncul modal ringkasan pilihan (*Ya, Simpan* / *Ganti Pilihan*).
5. Setelah disimpan, kode ditandai terpakai, muncul pesan sukses singkat, lalu **otomatis kembali ke halaman input kode** (±3–5 detik) untuk pemilih berikutnya.
6. Suara tidak dapat diubah setelah disimpan.

**Aturan validasi**
- Satu kode hanya berlaku **maksimal 1 kali** memilih.
- Penyimpanan suara bersifat **atomik**: tanda "sudah memilih" dan suara tersimpan dalam satu transaksi, sehingga tidak ada suara ganda saat dua perangkat memakai kode yang sama bersamaan.
- Suara **anonim**: data suara tidak menyimpan identitas pemilih.
- Tombol "Keluar Sesi" tersedia; sesi pemilih habis otomatis jika tidak aktif.

---

## 4. Fitur per Halaman

### 4.1 Halaman Bilik Suara (`/bilik`)
- **Input kode unik**: satu kolom + tombol "Buka Surat Suara", ada jam dan nama bilik, mode layar penuh.
- **Pemilihan**: kartu kandidat per jabatan (nomor urut, foto, nama, info singkat, tautan *Lihat Visi & Misi*). Kartu terpilih diberi penanda. Bar status di bawah menampilkan progres pilihan per jabatan.
- **Konfirmasi**: modal ringkasan pilihan.
- **Modal penolakan**: untuk kode yang sudah dipakai.

### 4.2 Dashboard Admin (`/admin`) — wajib login

| Menu | Fungsi |
|---|---|
| **Dashboard** | Ringkasan: judul & status pemilu, total DPT/kuota, sudah memilih, belum memilih, persentase partisipasi, status bilik real-time (Kosong/Terpakai), aktivitas audit terbaru. Tombol pintas *Lihat Hasil Live* dan *Kelola Status Pemilu*. |
| **Kelola Pemilu** | Buat/ubah pemilu: nama, periode, daftar jabatan, status (**Draft → Open → Closed**), jumlah bilik. |
| **Data** | Daftar Pemilih Tetap (DPT): tambah, edit, hapus, impor/ekspor CSV, generate kode unik, cari & filter (kelompok/status), tampilkan status (Sudah/Belum Memilih) dan waktu, aksi *Reset* hak pilih (tercatat di audit). |
| **Kandidat** | CRUD kandidat per jabatan: nomor urut, nama, foto, info singkat, visi & misi. |
| **Kelola Petugas** | Catat data petugas dan penempatan bilik. |
| **Hasil Voting** | Rekap suara per jabatan, persentase, partisipasi. Hanya final saat pemilu Closed. |
| **Audit Log & Ekspor** | Riwayat aktivitas (login admin gagal, ubah status pemilu, kode dipakai/ditolak, reset, dll). Ekspor hasil dan log ke CSV/Excel/PDF. |
| **Pengaturan Web** | Nama & logo penyelenggara, tema/warna, format & panjang kode unik, mode terang/gelap, tampil/sembunyikan hasil live. |

### 4.3 Live Preview (`/live`) — untuk proyektor
- Hasil per jabatan: foto, nama, jumlah suara sah, persentase, bar perolehan, penanda **Suara Terbanyak**.
- Filter: *Semua / per jabatan*. Tampilan: *Kartu / Grafik*.
- Kontrol: *Auto-Slide*, *Mode Gelap*, *Layar Penuh*, tombol kembali ke Admin.
- Footer: partisipasi (%), total suara masuk, **integritas rekonsiliasi** (jumlah suara cocok dengan jumlah pemilih yang sudah memilih), waktu pembaruan terakhir.
- Pembaruan otomatis secara **real-time melalui Supabase Realtime** (dengan fallback polling ≤ 5 detik jika koneksi jaringan terputus). Dapat dimatikan admin lewat Pengaturan Web.

### 4.4 Fitur Real-Time (Supabase Realtime)
Sistem menggunakan tiga kemampuan utama **Supabase Realtime** untuk menjaga sinkronisasi data antar-perangkat secara instan:
1. **Postgres Changes (Database CDC):**
   - **Rekap Hasil Suara:** Layar Live Preview (`/live`) mendengarkan perubahan data suara baru untuk mengupdate diagram & persentase secara instan tanpa me-reload halaman.
   - **Partisipasi Pemilih:** Counter DPT yang sudah/belum memilih pada dashboard admin ter-update otomatis begitu pemilih menyelesaikan voting.
   - **Status Pemilu:** Perubahan status pemilu (`DRAFT` → `OPEN` → `CLOSED`) oleh admin langsung mengaktifkan atau mengunci bilik suara seketika.
2. **Supabase Presence:**
   - **Monitoring Bilik Suara:** Memantau status konektivitas setiap bilik suara secara live di Dashboard Admin (*Online*, *Idle / Siap*, *Sedang Digunakan*, atau *Offline / Terputus*) tanpa membebani penulisan ke database.
3. **Supabase Broadcast:**
   - **Sinyal Kontrol Cepat:** Mengirimkan sinyal darurat atau perintah sinkronisasi dari admin ke seluruh bilik (misalnya reset tampilan bilik atau instruksi refresh sesi).
4. **Fallback & Resiliensi Jaringan:**
   - Deteksi otomatis status koneksi WebSocket dengan reconnection loop dan fallback ke HTTP polling jika koneksi lokal tidak stabil.

---

## 5. Model Data (Ringkas)

| Tabel | Kolom Utama |
|---|---|
| `admins` | id, nama, email, password_hash, role |
| `elections` | id, nama, periode, status (draft/open/closed) |
| `positions` | id, election_id, nama_jabatan, urutan |
| `candidates` | id, position_id, no_urut, nama, foto, info, visi_misi |
| `voters` | id, election_id, kode_unik (unik), nama, kelompok, has_voted, voted_at |
| `votes` | id, election_id, position_id, candidate_id, created_at *(tanpa voter_id)* |
| `booths` | id, election_id, nama, status |
| `staff` | id, nama, booth_id |
| `audit_logs` | id, aksi, aktor, detail, ip, created_at |
| `settings` | key, value |

---

## 6. Kebutuhan Non-Fungsional

- **Keamanan:** hash password admin, rate limit input kode (anti tebak), HTTPS, proteksi CSRF, kode unik acak dan tidak berurutan.
- **Integritas:** transaksi atomik, rekonsiliasi suara vs pemilih, semua aksi sensitif masuk audit log.
- **Performa:** mampu melayani ±1.000 pemilih dan beberapa bilik bersamaan; halaman live memuat < 2 detik; latensi pembaruan Supabase Realtime < 1 detik dalam kondisi jaringan normal.
- **Tampilan:** responsif (tablet bilik, layar proyektor, desktop admin), mendukung mode terang/gelap, bahasa Indonesia.
- **Ketersediaan:** berjalan stabil selama hari pemilihan; backup data sebelum pemilu dibuka dan setelah ditutup; resiliensi koneksi realtime dengan reconnection loop otomatis.

---

## 7. Kriteria Sukses

- Satu kode tidak bisa dipakai lebih dari sekali (diuji termasuk skenario bersamaan).
- Setelah voting sukses, layar kembali ke input kode otomatis.
- Total suara = jumlah pemilih yang sudah memilih (rekonsiliasi 100% cocok).
- Pembaruan hasil suara di Live Preview dan status bilik di Admin berjalan instan via Supabase Realtime tanpa reload halaman.
- Admin dapat membuat pemilu baru dengan jabatan, kandidat, dan pemilih berbeda tanpa mengubah kode program.
- Hasil dan audit log dapat diekspor.

---

## 8. Tahapan Rilis

| Tahap | Cakupan |
|---|---|
| **MVP** | Login admin, Kelola Pemilu, Data (DPT & kode unik), Kandidat, Bilik Suara, Hasil Voting |
| **Tahap 2** | Live Preview (Supabase Realtime Postgres Changes), Kelola Petugas, Audit Log & Ekspor |
| **Tahap 3** | Pengaturan Web, status bilik real-time (Supabase Presence), Broadcast sinyal admin, multi-pemilu, polesan UI |
