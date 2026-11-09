# Design System — Website E-Voting

Diturunkan dari `DESIGN.md` (Auralis System) dan disesuaikan untuk website pemilu. Stack: Next.js + Tailwind CSS v4 + shadcn/ui + Radix.

**Gaya:** minimalis arsitektural, **"quiet intelligence"**. Banyak ruang kosong, netral monokrom, elemen "mengambang" bergaya kaca (glass), tanpa bayangan tebal.

---

## 1. Prinsip

1. **Whitespace dulu.** Jarak antar bagian besar digandakan dari standar.
2. **Monokrom.** Hitam, putih, dan abu hangat. Warna hanya sebagai aksen kecil.
3. **Kedalaman lewat lapisan,** bukan bayangan berat: base → panel → kartu mengambang.
4. **Tombol pil, kartu membulat besar.**
5. **Status = titik kecil berwarna,** bukan banner besar.

---

## 2. Warna

### 2.1 Token Utama

| Token | Hex | Pakai untuk |
|---|---|---|
| `background` | `#fdf8f8` | Latar halaman |
| `on-background` / `on-surface` | `#1c1b1b` | Teks utama |
| `on-surface-variant` | `#444748` | Teks sekunder |
| `outline` | `#747878` | Border tegas, ikon pasif |
| `outline-variant` | `#c4c7c7` | Border halus |
| `primary` | `#000000` | Tombol utama, fokus |
| `on-primary` | `#ffffff` | Teks di atas primary |
| `primary-container` | `#1c1b1b` | Blok gelap |
| `secondary` | `#5e5e5e` | Aksi sekunder |
| `secondary-container` | `#e1dfdf` | Latar chip/badge |
| `error` | `#ba1a1a` | Kesalahan |
| `error-container` | `#ffdad6` | Latar pesan error |
| `on-error-container` | `#93000a` | Teks pesan error |
| `inverse-surface` | `#313030` | Toast / elemen gelap |
| `inverse-on-surface` | `#f4f0ef` | Teks di atas inverse |

### 2.2 Lapisan Permukaan

| Token | Hex |
|---|---|
| `surface-container-lowest` | `#ffffff` |
| `surface-container-low` | `#f7f3f2` |
| `surface-container` | `#f1edec` |
| `surface-container-high` | `#ebe7e6` |
| `surface-container-highest` | `#e5e2e1` |

### 2.3 Lapisan Elevasi (dari DESIGN.md)

| Level | Peran | Warna | Border |
|---|---|---|---|
| 0 | Base / latar | `#F7F7F5` | — |
| 1 | Panel | `#F3F2EF` | 1px `#E7E7E4` |
| 2 | Kartu mengambang | Putih / kaca semi-transparan | 1px `#E7E7E4` |

> **Catatan:** DESIGN.md memakai dua set netral (token `#fdf8f8` dan elevasi `#F7F7F5`). Untuk konsisten, gunakan **§2.1–2.2 untuk token Tailwind**, dan nilai **§2.3** untuk panel/kartu/border. Tentukan satu set saja sebelum implementasi.

### 2.4 Warna Status (usulan, belum ada di DESIGN.md)

Dipakai sebagai titik kecil (8px) di samping label.

| Status | Contoh pemakaian | Warna |
|---|---|---|
| Aktif / Sukses | Sudah memilih, Bilik kosong, Pemilu Open | Hijau |
| Proses / Peringatan | Bilik terpakai, Draft | Kuning/Amber |
| Error | Kode salah, Akses ditolak | `error` `#ba1a1a` |
| Netral | Belum memilih, Closed | `outline` `#747878` |

### 2.5 Orb Aksen (dekoratif)

Gradien buram lembut di belakang panel kaca, dipakai **hemat** (mis. halaman input kode bilik, header Live Preview). Tidak pernah berupa warna solid dan tidak boleh mengganggu data.

### 2.6 Mode Gelap (usulan)

Belum didefinisikan di DESIGN.md. Gunakan `inverse-surface` `#313030` / `#1c1b1b` sebagai latar dan `inverse-on-surface` `#f4f0ef` sebagai teks. Dikelola lewat `next-themes`.

---

## 3. Tipografi

Font: **Inter** (muat lewat `next/font/google`).

| Gaya | Ukuran | Berat | Line-height | Letter-spacing |
|---|---|---|---|---|
| `h1` | 64px | 600 | 1.1 | -0.02em |
| `h2` | 40px | 500 | 1.2 | -0.01em |
| `h3` | 24px | 500 | 1.3 | — |
| `body-lg` | 16px | 400 | 1.6 | — |
| `body-sm` | 14px | 400 | 1.6 | — |
| `caption` | 12px | 500 | 1.4 | 0.02em |
| `button` | 14px | 500 | 1 | — |

**Aturan**
- Judul rapat (line-height kecil, spasi huruf negatif) untuk kesan "terkunci".
- Label/metadata boleh HURUF KAPITAL dengan letter-spacing lebih lebar.
- Ukuran `h1` dipakai di judul pemilu pada layar proyektor; di dashboard cukup `h3`.

---

## 4. Spasi & Layout

| Token | Nilai |
|---|---|
| Satuan dasar | 8px |
| Lebar maksimum kontainer | 1440px |
| Gutter | 24px |
| Margin horizontal | 40px |
| Tinggi header | 72px |

- **Dashboard admin:** grid 12 kolom, kontainer tengah (fixed grid).
- **Halaman bilik & editorial:** grid 8 kolom, rata tengah.
- **Padding dalam kartu/panel:** minimal **32px** (ideal 32–48px).
- Skala spasi kelipatan 8px (8, 16, 24, 32, 40, 48 …).

---

## 5. Bentuk (Radius)

| Token | Nilai | Pakai untuk |
|---|---|---|
| `sm` | 0.25rem (4px) | Detail kecil |
| `DEFAULT` | 0.5rem (8px) | **Input** |
| `md` | 0.75rem (12px) | Chip, badge |
| `lg` | 1rem (16px) | Elemen dalam kartu |
| `xl` | 1.5rem (24px) | **Kartu** |
| panel besar | 20–28px | Panel & modal |
| `full` | 9999px | **Semua tombol (pil)** |

---

## 6. Elevasi & Kedalaman

- Tanpa bayangan berat. Gunakan lapisan warna + border tipis.
- **Kartu mengambang:** 1px border `#E7E7E4` + glow lembut `0 0 40px rgba(0,0,0,0.02)`.
- **Glass:** `backdrop-filter: blur(20px)` untuk header, sidebar, dan overlay modal (rentang 20–40px).

---

## 7. Komponen

| Komponen | Spesifikasi |
|---|---|
| **Tombol utama** | Pil hitam `#000`, teks putih, `button` 14/500 |
| **Tombol sekunder** | Pil, latar `#F3F2EF`, teks utama |
| **Kartu** | Radius 24px, border 1px `#E7E7E4`, padding ≥ 32px, mengambang |
| **Header** | Fixed, tinggi 72px, kaca semi-transparan, tautan bergaya `caption` |
| **Input** | Isian `#F3F2EF` atau underline, radius 8px. Fokus: border 1px warna primary |
| **Panel kaca** | Untuk sidebar dan overlay, blur 20–40px |
| **Indikator status** | Titik kecil + label, bukan banner |
| **Modal** | Radius 24–28px, latar kaca/putih, overlay blur |
| **Toast** | `inverse-surface`, teks `inverse-on-surface` (via `sonner`) |

---

## 8. Penerapan di Halaman E-Voting

| Halaman | Penerapan |
|---|---|
| **Bilik: input kode** | Latar netral + orb samar, satu kartu mengambang di tengah, input besar, tombol pil hitam "Buka Surat Suara" |
| **Bilik: pemilihan** | Kartu kandidat radius 24px. Kartu terpilih: border `primary` 1–2px + label "Pilihan Anda". Bar status melekat di bawah (kaca) |
| **Modal konfirmasi** | Panel kaca ringkas, tombol utama "Ya, Simpan Pilihan Saya", tombol sekunder "Ganti Pilihan" |
| **Modal akses ditolak** | Kartu dengan `error-container`, titik/ikon error, teks `on-error-container` |
| **Live Preview** | Grid kartu lebar, angka persentase besar (`h2`/`h1`), bar perolehan tipis. Kandidat teratas diberi penanda "Suara Terbanyak" (chip) |
| **Dashboard admin** | Sidebar kaca, kartu statistik (angka `h2`, label `caption` kapital), tabel di panel level 1, status bilik berupa titik berwarna |

---

## 9. Implementasi Tailwind v4

`app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

@theme {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;

  --color-background: #fdf8f8;
  --color-foreground: #1c1b1b;
  --color-muted-foreground: #444748;
  --color-primary: #000000;
  --color-primary-foreground: #ffffff;
  --color-secondary: #5e5e5e;
  --color-secondary-container: #e1dfdf;
  --color-outline: #747878;
  --color-outline-variant: #c4c7c7;
  --color-error: #ba1a1a;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;

  --color-panel: #f3f2ef;        /* level 1 */
  --color-border-soft: #e7e7e4;  /* border kartu */

  --radius-input: 0.5rem;
  --radius-card: 1.5rem;
  --radius-pill: 9999px;

  --shadow-float: 0 0 40px rgba(0, 0, 0, 0.02);
  --spacing-header: 72px;
}
```

Aturan pakai dengan shadcn:
- Override varian `Button` ke `rounded-full`; `Card` ke `rounded-[24px]` + `border-border-soft` + `p-8`.
- Header/sidebar/overlay: kelas `backdrop-blur-[20px]` dengan latar semi-transparan.
- Kontainer: `max-w-[1440px] mx-auto px-10`.

---

## 10. Do & Don't

| Do | Don't |
|---|---|
| Whitespace lega, padding kartu ≥ 32px | Menjejalkan konten rapat |
| Tombol pil, kartu radius besar | Tombol persegi / radius kecil di kartu |
| Titik kecil untuk status | Banner warna besar |
| Orb aksen samar dan hemat | Warna aksen solid atau orb mencolok |
| Border tipis + glow 2% | Bayangan tebal |
| Teks hitam di atas terang (kontras tinggi) | Teks abu pucat untuk informasi penting |
