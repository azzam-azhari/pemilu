import { NuqsAdapter } from "nuqs/adapters/next/app";
import { createClient } from "@/lib/supabase/server";
import { querySchema, type Voter } from "@/lib/dpt";
import { DptTable } from "@/components/admin/dpt-table";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Data Pemilih Tetap (DPT) — Admin",
  description: "Daftar pemilih, kode unik, dan status hak suara.",
};

export default async function AdminDataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) throw new Error("Parameter pemilu tidak valid.");
  const q = parsed.data;
  const db = await createClient();

  const { data: elections, error: ee } = await db
    .from("elections")
    .select("id,nama,status")
    .order("created_at", { ascending: false });
  if (ee) throw new Error("Daftar pemilu gagal dimuat.");

  const selected = elections?.find((e) => e.id === q.pemilu) ?? elections?.[0];
  let rows: Voter[] = [];
  let count = 0;

  if (selected) {
    let query = db
      .from("voters")
      .select("id,nama,kelompok,kode_unik,has_voted,voted_at", { count: "exact" })
      .eq("election_id", selected.id);

    const literal = (s: string) =>
      s.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
    if (q.q) query = query.ilike("nama", "%" + literal(q.q) + "%");
    if (q.kelompok) query = query.ilike("kelompok", "%" + literal(q.kelompok) + "%");
    if (q.status !== "semua") query = query.eq("has_voted", q.status === "sudah");

    const result = await query
      .order(q.sort, { ascending: q.arah === "asc", nullsFirst: false })
      .order("id")
      .range((q.page - 1) * q.size, q.page * q.size - 1);
    if (result.error) throw new Error("Data pemilih gagal dimuat.");
    rows = result.data ?? [];
    count = result.count ?? 0;
  }

  return (
    <main className="w-full min-w-0 flex-1 space-y-4 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Manajemen Pemilih
            </p>
            {selected && (
              <Badge
                variant={selected.status === "open" ? "default" : "outline"}
                className="text-[10px] uppercase font-medium h-4 px-1.5"
              >
                Pemilu: {selected.status}
              </Badge>
            )}
          </div>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Data Pemilih Tetap (DPT)
          </h1>
        </div>

        {selected && (
          <div className="text-xs text-muted-foreground sm:text-right">
            <span>Pemilu aktif: </span>
            <strong className="text-foreground">{selected.nama}</strong>
          </div>
        )}
      </div>

      <NuqsAdapter>
        <DptTable
          rows={rows}
          count={count}
          elections={elections ?? []}
          election={selected?.id ?? ""}
          closed={selected?.status === "closed"}
        />
      </NuqsAdapter>
    </main>
  );
}
