import { z } from "zod";

export const webSettingsSchema = z.object({
  nama_penyelenggara: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  logo_url: z.string().nullable().optional(),
  tema: z.enum(["system", "light", "dark"]).default("system"),
  format_kode_prefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_-]{1,16}$/, "Awalan harus huruf kapital, angka, dash (-), atau underscore (_)")
    .default("PEMILU-"),
  format_kode_length: z.coerce.number().int().min(4).max(32).default(6),
  tampilkan_hasil_live: z.boolean().default(true),
});

export type WebSettings = z.infer<typeof webSettingsSchema>;

