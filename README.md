# Platform E-Voting Pemilihan Ketua Umum

Platform pemilihan umum digital yang dirancang untuk pemilihan ketua organisasi, himpunan, komunitas, sekolah, maupun kampus. Sistem mengutamakan asas **Luber Jurdil** (Langsung, Umum, Bebas, Rahasia, Jujur, dan Adil) dengan jaminan **1 pemilih = 1 kode unik = maksimal 1 kali memilih**, transaksi suara atomik anti-ganda, rekonsiliasi suara otomatis, pemantauan proyektor secara real-time via Supabase Realtime, dan dashboard pengelolaan admin yang aman.

---

## 1. Arsitektur & Teknologi

```text
Klien Browser (Bilik Suara / Live Proyektor / Admin)
                      │
   Next.js 16 (React 19, App Router, TypeScript, Tailwind CSS v4)
   ├─ Server Actions & Server Components (Zod validation, rate limiter)
   └─ Client Components (Bilik interaktif, diagram Recharts, mode gelap)
                      │
   Supabase (PostgreSQL 15+, Auth, Realtime, Storage)
   ├─ Row Level Security (RLS) di seluruh tabel
   ├─ Transaksi Atomik (RPC security definer)
   ├─ Supabase Realtime (Postgres Changes, Presence bilik, Broadcast)
   └─ Storage Bucket (foto kandidat & logo penyelenggara)
```

### Stack Utama
- **Runtime**: Node.js v22.15.0+
- **Framework**: Next.js 16 (App Router) & React 19
- **Styling**: Tailwind CSS v4 & Lucide Icons
- **Komponen UI**: shadcn/ui & Radix UI Primitives
- **Database & Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Local Test Engine**: `@electric-sql/pglite` (pengujian Postgres in-memory lokal)

---

## 2. Struktur Menu & Peran Pengguna

| Peran | Akses Halaman | Kebutuhan Login | Deskripsi |
|---|---|---|---|
| **Pemilih** | `/bilik` | Tidak (Cukup Kode Unik) | Memasukkan kode unik sekali pakai, memilih kandidat per jabatan, konfirmasi pilihan, auto-reset layar (4 detik). |
| **Publik / Saksi** | `/live` | Tidak (Read-Only) | Tampilan proyektor perolehan suara live, diagram batang/kartu, auto-slide, dan indikator status rekonsiliasi suara. |
| **Admin** | `/admin/*` | Ya (Email & Password) | Manajemen pemilu, kandidat, DPT (impor CSV & generate kode unik), petugas, hasil rekapitulasi, audit log, dan pengaturan web. |

---

## 3. Panduan Setup Lokal

### Prasyarat
- **Node.js** versi 22.15.0 atau lebih baru.
- **npm** versi 10+
- Akun proyek di [Supabase](https://supabase.com) (atau Supabase CLI lokal).

### Langkah Instalasi
1. **Kloning Repositori**:
   ```bash
   git clone <repo-url>
   cd pemilu
   ```

2. **Instal Dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**:
   Salin file template `.env.example` menjadi `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Isi nilai variabel sesuai proyek Supabase Anda (lihat bagian *Variabel Lingkungan* di bawah).

4. **Migrasi Database**:
   - Buka dashboard Supabase Anda > **SQL Editor**.
   - Buka file `supabase/migrations/full_schema_all_phases.sql` di editor Anda.
   - Salin seluruh isinya dan jalankan (Run) di Supabase SQL Editor.
   - Skema lengkap akan mengaktifkan seluruh tabel, ekstensi, RLS policies, trigger proteksi, dan fungsi RPC atomik.

5. **Membuat Akun Admin Pertama**:
   - Di dashboard Supabase, buka menu **Authentication** > **Users** > **Add User** (Create User).
   - Masukkan Email dan Password admin.
   - Pada kolom User Metadata (JSON), masukkan:
     ```json
     { "nama": "Ketua Panitia Pemilu" }
     ```
   - Trigger otomatis database akan menyinkronkan user baru tersebut ke dalam tabel `public.admins`.

6. **Konfigurasi Supabase Storage**:
   - Pastikan bucket `candidate-photos` sudah dibuat dengan akses publik (public read).
   - Skema migrasi sudah otomatis mendaftarkan bucket jika ekstensi storage aktif.

7. **Jalankan Pengujian Otomatis**:
   ```bash
   npm test
   ```
   Seluruh 37 skenario pengujian (konkurensi, kode unik, RLS, rekonsiliasi) akan dieksekusi menggunakan PGlite lokal.

8. **Jalankan Server Pengembangan**:
   ```bash
   npm run dev
   ```
   Buka peramban di `http://localhost:3000`.

---

## 4. Variabel Lingkungan (`.env`)

Konfigurasikan variabel lingkungan berikut pada `.env.local` (pengembangan) dan pada Dashboard Hosting (produksi):

```env
# URL API proyek Supabase Anda (ditemukan di Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Anon Public API Key (aman untuk browser, diproteksi Row Level Security)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Supabase Service Role Key (SERVER ONLY - JANGAN PERNAH DIBOCORKAN KE CLIENT)
# Digunakan untuk Server Actions voting atomik dan manajemen DPT
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Otomatis diset oleh Vercel saat deployment (1 = produksi Vercel)
# VERCEL=1
```

> [!CAUTION]
> Nilai `SUPABASE_SERVICE_ROLE_KEY` memiliki hak administratif penuh pada database. Kunci ini hanya diakses pada sisi server melalui Server Actions yang telah dilindungi (`server-only`). Jangan pernah menambahkan prefix `NEXT_PUBLIC_` pada kunci ini.

---

## 5. Panduan Deployment Produksi

### A. Deploy ke Vercel
1. Hubungkan repositori GitHub/GitLab Anda ke [Vercel](https://vercel.com).
2. Di bagian **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Gunakan Build Command default: `npm run build` (atau `next build`).
4. Klik **Deploy**.

### B. Konfigurasi Produksi Supabase
1. **Disable Public Sign-up**:
   - Buka **Authentication** > **Providers** > **Email**.
   - Matikan (uncheck) opsi *"Enable Signups"*. Hal ini memastikan hanya panitia yang dapat didaftarkan sebagai admin.
2. **Aktifkan Realtime Publication**:
   - Pastikan tabel berikut terdaftar dalam publikasi `supabase_realtime`:
     - `elections`
     - `booths`
     - `settings`
3. **Konfigurasi CORS / Site URL**:
   - Pada **Authentication** > **URL Configuration**, set **Site URL** ke domain Vercel Anda (misal: `https://pemilu-organisasi.vercel.app`).
   - Tambahkan redirect URI: `https://pemilu-organisasi.vercel.app/**`.

---

## 6. Checklist Hari Pemilihan (Election Day Checklist)

Gunakan daftar periksa berikut agar proses pemungutan suara berjalan tertib, aman, dan tanpa kendala teknis:

### 📋 H-1 (Persiapan Sistem & Logistik)
- [ ] **Finalisasi DPT & Kode Unik**:
  - Semua pemilih sudah terdaftar di menu `/admin/data`.
  - Ekspor cadangan DPT beserta kode unik ke CSV via tombol *Ekspor CSV* dan simpan di flashdisk terenkripsi/tempat aman.
  - Cetak slip kode unik sekali pakai untuk dibagikan kepada pemilih saat registrasi kehadiran.
- [ ] **Uji Coba Bilik Suara Fisik (Tablet/Laptop)**:
  - Buka `/bilik?bilik=<id-bilik>` pada setiap perangkat bilik suara.
  - Uji mode layar penuh (*Fullscreen*) dan uji coba 1 kode tes (pada pemilu latihan) untuk memastikan layar kembali otomatis ke input kode setelah pemilihan.
- [ ] **Uji Coba Layar Proyektor**:
  - Buka `/live` pada laptop yang terhubung ke proyektor aula/ruang utama.
  - Aktifkan mode layar penuh dan sesuaikan tema (Gelap/Terang) serta opsi *Auto-Slide*.
- [ ] **Simulasi Jaringan**:
  - Pastikan seluruh laptop bilik dan proyektor terhubung ke jaringan Wi-Fi lokal yang stabil.

### 📋 H-30 Menit (Sebelum Pembukaan Pemungutan Suara)
- [ ] **Cek Status Bilik Suara**:
  - Buka `/admin` > periksa status bilik (seluruh bilik harus berstatus *Kosong / Siap*).
- [ ] **Pastikan Database Bersih**:
  - Pastikan suara uji coba kemarin sudah di-reset atau pemilu resmi telah disiapkan.
- [ ] **Buka Status Pemilu**:
  - Pada `/admin/pemilu`, ubah status pemilu dari `DRAFT` menjadi `OPEN`.
  - Begitu status menjadi `OPEN`, bilik suara secara otomatis siap menerima kode unik pemilih.

### 📋 Saat Pemilihan Berlangsung (Monitoring & Pengawasan)
- [ ] **Pantau Partisipasi & Bilik**:
  - Monitor persentase kehadiran pemilih secara berkala di dashboard admin.
  - Pantau aktivitas bilik (status *Terpakai* saat ada pemilih dan otomatis kembali *Kosong* saat selesai).
- [ ] **Penanganan Kendala Kode Unik**:
  - Jika muncul peringatan *"Hak Suara Sudah Digunakan"*, periksa riwayat di `/admin/audit` untuk memverifikasi waktu penggunaan sebelumnya.
  - Jika terjadi kendala darurat (misal kartu pemilih rusak sebelum memilih), gunakan aksi *Reset Kode* pada DPT (aksi ini akan otomatis dicatat di Audit Log).

### 📋 Pasca Penutupan Pemilihan (Penetapan Hasil)
- [ ] **Kunci Pemungutan Suara**:
  - Pada `/admin/pemilu`, ubah status pemilu dari `OPEN` menjadi `CLOSED`.
  - Sistem secara instan mengunci seluruh bilik suara sehingga tidak ada lagi suara yang dapat masuk.
- [ ] **Verifikasi Rekonsiliasi Suara**:
  - Buka menu `/admin/hasil` dan periksa status **Rekonsiliasi Suara**.
  - Pastikan indikator menyatakan: **Cocok (100% Valid)**:
    $$\text{Total Suara Tiap Jabatan} = \text{Total Pemilih yang Menggunakan Hak Suara}$$
- [ ] **Ekspor Dokumen Resmi**:
  - Unduh Berita Acara Rekapitulasi Suara ke format CSV/Excel.
  - Unduh Audit Log aktivitas pemilu lengkap sebagai bukti transparansi.
- [ ] **Pengumuman Resmi**:
  - Layar `/live` secara otomatis menandai status pemilu sebagai *Hasil Akhir Resmi (Final)*.

---

## 7. Skrip npm yang Tersedia

| Perintah | Deskripsi |
|---|---|
| `npm run dev` | Menjalankan Next.js development server pada port 3000 |
| `npm test` | Menjalankan seluruh pengujian otomatis lokal via PGlite |
| `npm run build` | Melakukan build produksi Next.js |
| `npm run lint` | Menjalankan ESLint 9 untuk memeriksa kualitas kode |
| `node scripts/generate_full_schema.mjs` | Mengompilasi seluruh file migrasi menjadi satu skema terpadu |

---

## 8. Lisensi & Hak Cipta
Hak Cipta © 2026 Tim Penyelenggara Pemilihan Umum. Didistribusikan untuk penggunaan internal organisasi yang aman dan terpercaya.

