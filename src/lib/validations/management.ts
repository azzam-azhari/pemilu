import { z } from "zod";
export const managementSchema = z.object({
  entity: z.enum(["elections","positions","candidates"]),
  id: z.string().uuid().optional(),
  parent: z.string().uuid().optional(),
  nama: z.string().trim().min(3,"Minimal 3 karakter").max(160),
  nomor: z.number().int().positive().max(10000),
  mulai: z.string().refine(v=>v==="" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))),"Tanggal tidak valid"),
  selesai: z.string().refine(v=>v==="" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v))),"Tanggal tidak valid"),
  info: z.string().max(500),
  visi_misi: z.string().max(10000),
}).refine(v=>!v.mulai || !v.selesai || v.selesai>v.mulai,{message:"Tanggal selesai harus setelah mulai",path:["selesai"]});
export type ManagementInput = z.infer<typeof managementSchema>;
