import { z } from "zod";

export const auditQuerySchema = z.object({
  q: z.string().max(160).catch(""),
  aksi: z.string().max(100).catch("semua"),
  aktor: z.string().max(160).catch("semua"),
  dari: z.string().catch(""),
  sampai: z.string().catch(""),
  sort: z.enum(["created_at", "aksi", "aktor"]).catch("created_at"),
  arah: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
  size: z.coerce.number().refine((n) => [10, 25, 50, 100].includes(n)).catch(25),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

export type AuditLogItem = {
  id: number;
  aksi: string;
  aktor: string;
  detail: Record<string, unknown>;
  ip: string | null;
  created_at: string;
};

