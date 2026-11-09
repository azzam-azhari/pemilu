"use server";

import { createClient } from "@/lib/supabase/server";
import { electionResultsSchema, type ElectionResultsResponse } from "@/lib/validations/results";

export async function getElectionResults(electionId?: string): Promise<ElectionResultsResponse> {
  try {
    const supabase = await createClient();
    let targetElectionId = electionId;

    if (!targetElectionId) {
      const { data: openElection } = await supabase
        .from("elections")
        .select("id")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openElection?.id) {
        targetElectionId = openElection.id;
      } else {
        const { data: latestElection } = await supabase
          .from("elections")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        targetElectionId = latestElection?.id;
      }
    }

    if (!targetElectionId) {
      return { ok: false, reason: "pemilu_tidak_ditemukan" };
    }

    const { data, error } = await supabase.rpc("get_election_results", {
      p_election_id: targetElectionId,
    });

    if (error) {
      return { ok: false, reason: error.message };
    }

    return electionResultsSchema.parse(data);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Gagal memuat hasil voting",
    };
  }
}

export async function getElectionsList() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("elections")
      .select("id, nama, status, created_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

