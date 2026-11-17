import { ElectionManager } from "@/components/admin/election-manager";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Kelola Pemilu & Jabatan — Admin",
  description: "Pengaturan pemilu, periode aktif, dan struktur jabatan.",
};

export default async function AdminPemiluPage({
  searchParams,
}: {
  searchParams: Promise<{ pemilu?: string }>;
}) {
  const db = await createClient();
  const q = await searchParams;

  const { data: elections, error } = await db
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Tidak dapat memuat data pemilu.");

  const selected = elections?.find((e) => e.id === q.pemilu) ?? elections?.[0];
  const positions = selected
    ? await db
        .from("positions")
        .select("*")
        .eq("election_id", selected.id)
        .order("urutan")
    : null;

  if (positions?.error) throw new Error("Tidak dapat memuat data jabatan.");

  const openCount = elections?.filter((e) => e.status === "open").length ?? 0;

  return (
    <main className="w-full min-w-0 flex-1 space-y-4 p-4 md:p-6">
      {/* Header Halaman Padat */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Konfigurasi Master
            </p>
            {openCount > 0 ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium h-4 px-1.5">
                {openCount} Pemilu Aktif
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground font-medium h-4 px-1.5">
                Tidak ada pemilu aktif
              </Badge>
            )}
          </div>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kelola Pemilu & Jabatan
          </h1>
        </div>

        {selected && (
          <div className="text-xs text-muted-foreground sm:text-right">
            <span>Fokus saat ini: </span>
            <strong className="text-foreground">{selected.nama}</strong>
          </div>
        )}
      </div>

      {/* Komponen Manager Pemilu & Jabatan Terpadu */}
      <ElectionManager
        elections={elections ?? []}
        selectedElectionId={selected?.id}
        positions={positions?.data ?? []}
      />
    </main>
  );
}
