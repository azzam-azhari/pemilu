import { z } from "zod";
export const codeSchema=z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{6,64}$/);
export const tokenSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const choicesSchema=z.array(z.object({position_id:z.string().uuid(),candidate_id:z.string().uuid()}).strict()).min(1).max(100).refine(items=>new Set(items.map(i=>i.position_id)).size===items.length);
const candidate=z.object({id:z.string().uuid(),nama:z.string(),nomor:z.number(),foto:z.string().nullable(),info:z.string().nullable(),visi_misi:z.string().nullable()});
export const sessionSchema=z.discriminatedUnion("ok",[
  z.object({ok:z.literal(false),reason:z.string()}),
  z.object({ok:z.literal(true),state:z.enum(["active","submitted","left"]),electionName:z.string().optional(),boothId:z.string().uuid().nullable().optional(),remainingMs:z.number().optional(),positions:z.array(z.object({id:z.string().uuid(),nama:z.string(),candidates:z.array(candidate)})).optional()}),
]);
export type SessionResult=z.infer<typeof sessionSchema>;
export type Position=NonNullable<Extract<SessionResult,{ok:true}>["positions"]>[number];
export const reasons:Record<string,string>={
  terlalu_banyak_percobaan:"Terlalu banyak percobaan. Tunggu sebelum mencoba kembali.",
  kode_tidak_valid:"Masukkan kode 6–64 karakter yang tertera pada kartu Anda.",
  kode_tidak_ditemukan:"Kode tidak ditemukan. Periksa kembali kode Anda.",
  kode_sudah_digunakan:"Hak Suara Sudah Digunakan",
  pemilu_belum_dibuka:"Pemilu belum dibuka atau sudah ditutup.",
  bilik_tidak_valid:"Konfigurasi bilik tidak tersedia. Hubungi petugas.",
  sesi_berakhir:"Sesi berakhir. Masukkan kode kembali untuk melanjutkan.",
  pilihan_tidak_valid:"Pilihan tidak valid. Periksa kembali surat suara.",
  pilihan_tidak_lengkap:"Pilih satu kandidat untuk setiap jabatan.",
  kandidat_tidak_valid:"Kandidat tidak sesuai dengan surat suara.",
  surat_suara_tidak_tersedia:"Surat suara belum lengkap. Hubungi petugas.",
  layanan_tidak_tersedia:"Koneksi bermasalah. Coba lagi; suara tidak akan disimpan dua kali.",
};
