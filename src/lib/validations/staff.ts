import { z } from "zod";

export const staffSchema = z.object({
  id: z.string().uuid().optional(),
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(160, "Maksimal 160 karakter"),
  booth_id: z.string().uuid().nullable().optional(),
});

export const boothSchema = z.object({
  id: z.string().uuid().optional(),
  election_id: z.string().uuid({ message: "Pemilu harus dipilih" }),
  nama: z.string().trim().min(2, "Nama bilik minimal 2 karakter").max(120, "Maksimal 120 karakter"),
  status: z.enum(["kosong", "terpakai", "nonaktif"]).default("kosong"),
});

export type StaffInput = z.infer<typeof staffSchema>;
export type BoothInput = z.infer<typeof boothSchema>;
export type StaffItem = {
  id: string;
  nama: string;
  booth_id: string | null;
  booth_name?: string | null;
  booth_status?: "kosong" | "terpakai" | "nonaktif" | null;
  created_at: string;
};
export type BoothItem = {
  id: string;
  election_id: string;
  nama: string;
  status: "kosong" | "terpakai" | "nonaktif";
  staff_name?: string | null;
  created_at: string;
};

