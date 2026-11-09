# ROADMAP — Website E-Voting

Rencana pembangunan bertahap dengan prompt singkat untuk agent Codex.

## Cara Pakai

1. Taruh `PRD.md`, `Techstack.md`, `design-system.md` di folder `docs/` repo.
2. Taruh blok **AGENTS.md** di bawah ini di root repo (aturan umum, jadi tidak diulang di tiap prompt).
3. Jalankan prompt per fase, **berurutan**. Selesai satu fase, cek bagian *Selesai bila*, commit, baru lanjut.

---

## Ringkasan Fase

| Fase | Hasil | Rilis (PRD) |
|---|---|---|
| 0 | Fondasi proyek & tema | MVP |
| 1 | Database, RLS, fungsi voting atomik | MVP |
| 2 | Login admin & kerangka dashboard | MVP |
| 3 | Kelola Pemilu & Kandidat | MVP |
| 4 | Data DPT & kode unik | MVP |
| 5 | Bilik suara (alur voting) | MVP |
| 6 | Hasil Voting & Live Preview | MVP + Tahap 2 |
| 7 | Petugas, Audit Log & Ekspor, Pengaturan Web | Tahap 2–3 |
| 8 | QA, keamanan, deploy | Rilis |

---

## AGENTS.md (taruh di root repo)

```md
# Aturan Proyek
- Baca `docs/PRD.md`, `docs/Techstack.md`, `docs/design-system.md` sebelum bekerja.
- Stack: Next.js (App Router), TypeScript, Tailwind v4, shadcn/ui, Supabase. Jangan tambah library di luar Techstack tanpa alasan.
- UI berbahasa Indonesia, ikuti design-system (pil, kartu 24px, whitespace lega).
- Validasi input dengan Zod di server. Logika sensitif hanya di Server Action/RPC; `service_role` hanya di server (`server-only`).
- Jangan pernah menyimpan identitas pemilih di tabel `votes`.
- Kerjakan hanya fase yang diminta. Selesai: jalankan `npm run lint` dan `npm run build`, lalu ringkas perubahan.
```

---

## Fase 0 — Fondasi Proyek

**Tujuan:** proyek siap dikembangkan dengan tema dan struktur folder.

- [ ] Rapikan dependency (`cn` diganti `clsx` + `tailwind-merge`, cek paket Tailwind untuk Next)
- [ ] Tema Tailwind v4 dari `design-system.md` §9, font Inter, `next-themes`
- [ ] Init shadcn, override `Button` pil dan `Card` 24px
- [ ] Struktur folder, helper Supabase (client/server), `.env.example`

**Selesai bila:** `npm run dev` jalan, halaman contoh tampil sesuai tema terang/gelap.

**Prompt**
```
Kerjakan Fase 0 (Fondasi) dari docs/ROADMAP.md.
Rapikan package.json (ganti paket `cn` dengan clsx + tailwind-merge, pastikan setup Tailwind v4 benar untuk Next).
Terapkan tema dari design-system.md §9 + font Inter + next-themes. Init shadcn: Button selalu pil, Card radius 24px.
Buat struktur folder sesuai Techstack §8, helper Supabase di lib/supabase (client, server), dan .env.example.
Buat satu halaman demo komponen untuk cek tema.
```

---

## Fase 1 — Database & Keamanan

**Tujuan:** skema, RLS, dan fungsi voting atomik.

- [ ] Migrasi semua tabel PRD §5
- [ ] Constraint unik `voters.kode_unik`
- [ ] RLS aktif; `votes` tidak bisa dibaca publik
- [ ] RPC `verify_code` dan `cast_vote` (transaksi atomik, catat audit)
- [ ] Seed data contoh (1 pemilu, 2 jabatan, 3 kandidat tiap jabatan, 20 pemilih)

**Selesai bila:** dua panggilan `cast_vote` bersamaan dengan kode sama → hanya satu berhasil.

**Prompt**
```
Kerjakan Fase 1 (Database & Keamanan).
Buat migrasi Supabase untuk semua tabel di PRD §5, constraint, index, dan RLS (tabel votes tertutup untuk publik).
Buat RPC `verify_code(kode)` dan `cast_vote(kode, pilihan[])`: cek status pemilu OPEN, kode valid & belum dipakai, simpan suara + set has_voted dalam satu transaksi, tulis audit_logs. Tabel votes tanpa voter_id.
Tambah seed data dan tes SQL untuk skenario kode ganda/bersamaan.
```

---

## Fase 2 — Login Admin & Kerangka Dashboard

**Tujuan:** hanya admin yang bisa masuk; layout dashboard siap.

- [ ] Halaman login (Supabase Auth), logout
- [ ] Proteksi `/admin/*` lewat middleware/proxy + cek tabel `admins`
- [ ] Layout: sidebar kaca 8 menu, header 72px, toggle tema
- [ ] Halaman Dashboard: kartu statistik (DPT, sudah/belum memilih, partisipasi), status pemilu

**Selesai bila:** akses `/admin` tanpa login diarahkan ke login; login gagal tercatat di audit.

**Prompt**
```
Kerjakan Fase 2 (Login Admin & Dashboard).
Login admin via Supabase Auth, proteksi /admin/* dengan middleware dan cek tabel admins (hanya admin yang boleh).
Buat layout dashboard: sidebar dengan menu PRD §4.2, header, toggle tema.
Halaman Dashboard: kartu statistik dan status pemilu dari data DB. Catat login gagal ke audit_logs.
Menu lain cukup placeholder.
```

---

## Fase 3 — Kelola Pemilu & Kandidat

**Tujuan:** admin bisa menyiapkan pemilu.

- [ ] CRUD pemilu: nama, periode, status Draft → Open → Closed
- [ ] CRUD jabatan, urutkan dengan drag & drop
- [ ] CRUD kandidat: nomor urut, nama, foto (Storage), info, visi-misi
- [ ] Aturan: pemilu Open tidak bisa ubah kandidat

**Selesai bila:** satu pemilu lengkap (jabatan + kandidat + foto) bisa dibuat dari UI.

**Prompt**
```
Kerjakan Fase 3 (Kelola Pemilu & Kandidat).
Halaman Kelola Pemilu: CRUD, ubah status (Draft/Open/Closed) dengan konfirmasi, kelola jabatan dengan drag & drop (dnd-kit).
Halaman Kandidat: CRUD per jabatan, upload foto ke Supabase Storage, form pakai react-hook-form + zod.
Blokir ubah kandidat/jabatan saat pemilu Open. Semua aksi lewat Server Action dan tercatat di audit_logs.
```

---

## Fase 4 — Data DPT & Kode Unik

**Tujuan:** daftar pemilih dan kodenya siap dipakai.

- [ ] Tabel DPT (TanStack Table): cari, filter, sortir, paginasi, filter di URL (nuqs)
- [ ] Tambah/edit/hapus pemilih, impor CSV
- [ ] Generate kode unik acak (panjang & format dari pengaturan), cegah duplikat
- [ ] Aksi *Reset* hak pilih (konfirmasi + audit)
- [ ] Ekspor daftar kode (CSV) untuk dicetak

**Selesai bila:** impor 1.000 baris CSV berhasil dengan kode unik semua.

**Prompt**
```
Kerjakan Fase 4 (Data DPT).
Halaman Data: tabel DPT dengan @tanstack/react-table, cari/filter/sortir/paginasi (state di URL via nuqs).
Fitur: tambah/edit/hapus, impor CSV (validasi zod, laporkan baris gagal), generate kode unik acak tanpa duplikat, ekspor CSV kode.
Aksi Reset hak pilih dengan dialog konfirmasi dan catat ke audit_logs. Tampilkan status Sudah/Belum Memilih + waktu.
```

---

## Fase 5 — Bilik Suara

**Tujuan:** alur voting lengkap dan aman.

- [ ] `/bilik`: input kode → validasi (salah / sudah dipakai / pemilu tidak Open)
- [ ] Halaman pemilihan: kartu kandidat per jabatan, bar status progres
- [ ] Modal konfirmasi → simpan lewat `cast_vote` → pesan sukses → **otomatis kembali ke input kode (3–5 detik)**
- [ ] Modal "Hak Suara Sudah Digunakan" + audit
- [ ] Sesi pemilih berupa token server singkat (httpOnly), habis otomatis jika idle
- [ ] Rate limit percobaan kode, mode layar penuh, nama bilik

**Selesai bila:** satu kode hanya bisa memilih sekali; layar kembali otomatis; hasil tersimpan tanpa identitas pemilih.

**Prompt**
```
Kerjakan Fase 5 (Bilik Suara) sesuai PRD §3 dan §4.1.
Alur: input kode -> verify_code -> halaman pemilihan (1 kandidat per jabatan) -> modal konfirmasi -> cast_vote -> sukses -> otomatis kembali ke input kode dalam 3-5 detik.
Tangani: kode salah, kode sudah dipakai (modal error + audit), pemilu tidak Open.
Sesi pemilih lewat token httpOnly berumur pendek + timeout idle; tambah rate limit input kode.
Ikuti design-system (orb samar, kartu mengambang, tombol pil). Tidak ada login pemilih.
```

---

## Fase 6 — Hasil Voting & Live Preview

**Tujuan:** hasil terpantau real-time di proyektor.

- [ ] Halaman Hasil Voting (admin): rekap per jabatan, persentase, partisipasi
- [ ] `/live`: kartu & grafik (Recharts), filter per jabatan, auto-slide, mode gelap, layar penuh
- [ ] Penanda *Suara Terbanyak*, footer partisipasi, total suara, **rekonsiliasi** (suara = pemilih yang sudah memilih)
- [ ] Supabase Realtime, fallback polling ≤ 5 detik
- [ ] Hasil lewat view/RPC agregat (tabel `votes` tetap tertutup)

**Selesai bila:** suara baru muncul di `/live` dalam ≤ 5 detik dan rekonsiliasi menunjukkan 100% cocok.

**Prompt**
```
Kerjakan Fase 6 (Hasil & Live Preview) sesuai PRD §4.3.
Buat view/RPC agregat suara per kandidat (jangan buka tabel votes ke publik).
Halaman Hasil Voting (admin) dan /live (publik): tampilan kartu/grafik (Recharts), filter jabatan, auto-slide, mode gelap, layar penuh, penanda Suara Terbanyak, footer partisipasi + rekonsiliasi.
Update via Supabase Realtime dengan fallback polling 5 detik. Hasil final hanya saat pemilu Closed di halaman admin.
```

---

## Fase 7 — Petugas, Audit Log & Pengaturan

**Tujuan:** lengkapi menu dashboard.

- [ ] Kelola Petugas: CRUD data petugas + penempatan bilik (tanpa akun login)
- [ ] Status bilik real-time (Kosong/Terpakai) di Dashboard
- [ ] Audit Log: tabel, filter, ekspor CSV/Excel/PDF; ekspor hasil
- [ ] Pengaturan Web: nama, logo, tema, format kode unik, tampil/sembunyikan hasil live

**Selesai bila:** semua 8 menu dashboard berfungsi dan ekspor terunduh.

**Prompt**
```
Kerjakan Fase 7 (Petugas, Audit Log, Pengaturan).
Kelola Petugas: CRUD + penempatan bilik (petugas tanpa akun login).
Dashboard: status bilik real-time (titik status sesuai design-system).
Audit Log: tabel dengan filter + ekspor CSV/Excel/PDF; ekspor hasil voting.
Pengaturan Web: nama/logo, tema, format kode unik, toggle tampil hasil live (dipatuhi oleh /live).
```

---

## Fase 8 — QA, Keamanan & Deploy

**Tujuan:** siap dipakai di hari pemilihan.

- [ ] Tes: voting bersamaan, kode ganda, pemilu non-Open, rekonsiliasi
- [ ] Audit RLS: pastikan `votes`, `voters` tidak bocor ke publik
- [ ] Uji beban ±1.000 pemilih, beberapa bilik
- [ ] Cek responsif (tablet bilik, proyektor, desktop admin) dan aksesibilitas dasar
- [ ] Deploy (Vercel + Supabase), env produksi, backup sebelum Open dan sesudah Closed
- [ ] Simulasi pemilu penuh (gladi resik)

**Selesai bila:** semua **Kriteria Sukses** di PRD §7 terpenuhi.

**Prompt**
```
Kerjakan Fase 8 (QA & Hardening).
Tulis tes otomatis untuk: voting bersamaan dengan kode sama, kode salah/terpakai, pemilu non-Open, rekonsiliasi suara.
Audit semua kebijakan RLS dan jalur service_role; laporkan dan perbaiki kebocoran.
Cek responsif dan aksesibilitas dasar. Tulis README: setup, env, deploy, dan checklist hari pemilihan.
Laporkan temuan dalam daftar singkat.
```

---

## Catatan

- Jika agent menyimpang, kembalikan ke dokumen: *"Ikuti docs/PRD.md §X"*.
- Satu fase = satu branch/PR agar mudah ditinjau.
- Fase 1 menentukan keamanan seluruh sistem. Tinjau manual sebelum lanjut.
