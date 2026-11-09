import { z } from "zod";

export const candidateResultSchema = z.object({
  id: z.string().uuid(),
  nomor: z.number().int().positive(),
  nama: z.string(),
  foto: z.string().nullable().optional(),
  info: z.string().nullable().optional(),
  visi_misi: z.string().nullable().optional(),
  votes: z.number().int().nonnegative(),
  percentage: z.number().nonnegative(),
  is_highest: z.boolean(),
});

export const positionResultSchema = z.object({
  id: z.string().uuid(),
  nama: z.string(),
  urutan: z.number().int().positive(),
  total_votes: z.number().int().nonnegative(),
  candidates: z.array(candidateResultSchema),
});

export const electionSummarySchema = z.object({
  total_dpt: z.number().int().nonnegative(),
  total_voted: z.number().int().nonnegative(),
  participation_percentage: z.number().nonnegative(),
  reconciliation_ok: z.boolean(),
  total_votes_cast: z.number().int().nonnegative(),
  is_final: z.boolean(),
  last_updated: z.string(),
});

export const electionMetadataSchema = z.object({
  id: z.string().uuid(),
  nama: z.string(),
  status: z.enum(["draft", "open", "closed"]),
  periode_mulai: z.string().nullable().optional(),
  periode_selesai: z.string().nullable().optional(),
});

export const electionResultsSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  election: electionMetadataSchema.optional(),
  positions: z.array(positionResultSchema).optional(),
  summary: electionSummarySchema.optional(),
});

export type CandidateResult = z.infer<typeof candidateResultSchema>;
export type PositionResult = z.infer<typeof positionResultSchema>;
export type ElectionSummary = z.infer<typeof electionSummarySchema>;
export type ElectionMetadata = z.infer<typeof electionMetadataSchema>;
export type ElectionResultsResponse = z.infer<typeof electionResultsSchema>;

