import { getAuditLogs } from "@/actions/audit";
import { getElectionsList } from "@/actions/results";
import { AuditTable } from "@/components/admin/audit-table";

export const metadata = {
  title: "Audit Log & Ekspor — Admin",
  description: "Riwayat aktivitas sistem dan ekspor laporan pemilu.",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    aksi?: string;
    aktor?: string;
    dari?: string;
    sampai?: string;
    page?: string;
    size?: string;
    sort?: string;
    arah?: string;
  }>;
}) {
  const params = await searchParams;
  const { rows, count, actionsList } = await getAuditLogs({
    q: params.q,
    aksi: params.aksi,
    aktor: params.aktor,
    dari: params.dari,
    sampai: params.sampai,
    page: params.page,
    size: params.size,
    sort: params.sort,
    arah: params.arah,
  });

  const elections = await getElectionsList();

  return (
    <main className="w-full min-w-0 flex-1 space-y-4 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center print:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Keamanan & Integritas
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Audit Log & Ekspor Laporan
          </h1>
        </div>
      </div>

      <AuditTable
        rows={rows}
        count={count}
        actionsList={actionsList}
        elections={elections}
      />
    </main>
  );
}
