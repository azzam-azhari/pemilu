# Techstack — Website E-Voting

Nama paket: `pemilu` v0.1.0 (private). Runtime: Node.js v22.15.0. Bahasa: TypeScript. Bahasa antarmuka: Indonesia.

---

## 1. Ringkasan Arsitektur

```
Browser (Bilik / Live / Admin)
        │
   Next.js 16 (Node.js v22.15.0, App Router, React 19)
   ├─ Server Components & Server Actions  → logika voting, validasi kode
   └─ Client Components                   → UI interaktif, grafik, form
        │
   Supabase
   ├─ Auth       → login admin
   ├─ Postgres   → data pemilu, pemilih, suara, audit log
   ├─ Realtime   → Live Preview & status bilik
   └─ Storage    → foto kandidat, logo
```

---

## 2. Stack Inti

| Lapisan | Teknologi | Versi | Peran |
|---|---|---|---|
| Runtime | **Node.js** | v22.15.0 | Lingkungan eksekusi JavaScript (server & build) |
| Framework | **Next.js** | 16.4.3 | Routing (`/bilik`, `/live`, `/admin`), SSR, Server Actions |
| UI Library | **React / React DOM** | 19.3.0 | Komponen antarmuka |
| Bahasa | **TypeScript** | ^5 | Type safety |
| Backend & DB | **Supabase** (`supabase-js`, `@supabase/ssr`) | ^2.118.0 / ^0.12.7 | Auth admin, Postgres, Realtime (Postgres Changes, Presence, Broadcast), Storage |
| Styling | **Tailwind CSS** | ^4 | Utility-first CSS |
| Komponen UI | **shadcn/ui** + **Radix UI** | ^4.22.1 / ^1.8.1 | Komponen aksesibel (dialog, select, dropdown, dll) |

---

## 3. Library Pendukung dan Penggunaannya

| Library | Dipakai untuk |
|---|---|
| `react-hook-form` + `@hookform/resolvers` + `zod` | Form (kandidat, pemilu, DPT, pengaturan) dan validasi skema di client dan server |
| `@tanstack/react-table` | Tabel Data (DPT), Audit Log: sortir, filter, paginasi |
| `recharts` | Grafik hasil voting di Live Preview dan Hasil Voting |
| `@dnd-kit/*` (core, sortable, modifiers, utilities) | Drag & drop pengurutan nomor urut kandidat dan jabatan |
| `nuqs` | State filter, pencarian, dan halaman tabel yang tersimpan di URL |
| `next-themes` | Mode terang/gelap |
| `sonner` | Notifikasi toast (sukses/gagal) |
| `vaul` | Drawer (panel samping/bawah, terutama di tablet) |
| `react-day-picker` | Pemilih tanggal (periode pemilu) |
| `lucide-react` | Ikon |
| `class-variance-authority` | Varian gaya komponen |
| `tw-animate-css` | Animasi (modal, transisi) |
| `server-only` | Memastikan kode sensitif (service key, logika voting) hanya jalan di server |

---

## 4. Pemetaan ke Fitur

| Fitur | Teknologi |
|---|---|
| Login admin | Supabase Auth + `@supabase/ssr` (sesi lewat cookie) + middleware/proxy Next.js |
| Validasi kode unik & simpan suara | Server Action + fungsi Postgres (RPC) dalam satu transaksi atomik |
| Anti suara ganda | Constraint unik pada kode + `has_voted` diubah di transaksi yang sama |
| Halaman bilik (input kode → pilih → konfirmasi → kembali otomatis) | Client Component + Server Action + Radix Dialog |
| Live Preview (proyektor) | Supabase Realtime (Postgres Changes) + Recharts + fallback polling |
| Dashboard & status bilik real-time | Server Components + Supabase Realtime (Postgres Changes & Presence) |
| Sinkronisasi bilik & darurat | Supabase Realtime (Broadcast) |
| Data / DPT, Kandidat | TanStack Table + React Hook Form + Zod + dnd-kit |
| Upload foto kandidat | Supabase Storage |
| Audit Log & Ekspor | Tabel `audit_logs` + ekspor CSV dari server |
| Mode gelap & tema | next-themes + Tailwind |
| Filter & pencarian | nuqs (query string di URL) |

---

## 5. Spesifikasi & Implementasi Supabase Realtime

Sistem mengadopsi tiga modul inti Supabase Realtime lewat koneksi WebSocket tunggal di client:

| Modul | Penggunaan | Saluran (Channel / Topic) | Perilaku & Manfaat |
|---|---|---|---|
| **Postgres Changes** | Hasil Live Suara | `realtime:votes-channel` | Menerima mutasi `INSERT` dari tabel `votes` untuk memperbarui diagram perolehan suara di `/live` secara instan tanpa reload. |
| **Postgres Changes** | Status Pemilu | `realtime:election-status` | Memantau perubahan kolom `status` pada `elections`. Ketika admin mengubah status (`OPEN` ↔ `CLOSED`), bilik suara otomatis membuka/mengunci layar secara serentak. |
| **Presence** | Pemantauan Bilik Suara | `realtime:booth-presence` | Klien bilik suara mendaftarkan status sesi (`idle`, `voting`, `offline`). Dashboard admin memantau bilik mana saja yang aktif dan sedang dipakai secara akurat tanpa write disk. |
| **Broadcast** | Kontrol Admin Cepat | `realtime:admin-broadcast` | Admin dapat memancarkan sinyal darurat (misal: refresh paksa bilik suara, reset sesi, pembersihan cache layar proyektor). |

### Resiliensi & Fallback Polling
- **Auto-reconnection:** Menggunakan listener bawaan Supabase Realtime status (`SUBSCRIBED`, `TIMED_OUT`, `CLOSED`).
- **Hybrid Fallback:** Jika WebSocket terhambat oleh firewall lokal atau koneksi tidak stabil, halaman `/live` dan dashboard admin otomatis beralih ke interval polling HTTP (3–5 detik) dan kembali ke Realtime setelah koneksi pulih.

---

## 6. Keamanan

- **Row Level Security (RLS)** aktif di semua tabel; tabel `votes` tidak bisa dibaca langsung oleh publik.
- Akses data sensitif dan penulisan suara hanya lewat **Server Action / RPC**, tidak langsung dari browser.
- Realtime Postgres Changes dilindungi RLS sehingga data yang tersiar ke listener publik hanya agregat atau data yang diizinkan.
- `service_role` key hanya dipakai di server (diimpor dengan `server-only`), tidak pernah dikirim ke client.
- Validasi input dengan **Zod** di server untuk setiap aksi.
- Rate limit pada percobaan kode unik untuk mencegah tebak-tebakan.
- Tabel `votes` tidak menyimpan identitas pemilih (anonim).

---

## 7. Environment Variable

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only
```

---

## 8. Perintah Pengembangan

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan mode pengembangan |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan hasil build |
| `npm run lint` | Cek kualitas kode (ESLint 9 + `eslint-config-next`) |

---

## 9. Struktur Folder (Usulan)

```
src/
├─ app/
│  ├─ bilik/            # halaman input kode & pemilihan
│  ├─ live/             # live preview proyektor
│  └─ admin/            # dashboard (dilindungi login)
│     ├─ pemilu/ data/ kandidat/ petugas/
│     └─ hasil/ audit/ pengaturan/
├─ components/ui/       # komponen shadcn
├─ lib/
│  ├─ supabase/         # client, server, middleware, realtime hooks
│  ├─ validations/      # skema Zod
│  └─ utils.ts          # helper cn()
└─ actions/             # Server Actions (voting, CRUD)
```

---

## 10. Hosting (Usulan)

- **Aplikasi:** Vercel (atau server Node sendiri dengan `next start`).
- **Database & Auth:** Supabase (cloud, atau self-host untuk jaringan lokal).
