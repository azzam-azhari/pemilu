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
    <main className="mx-auto max-w-[1440px] px-6 py-12 sm:px-10">
      <div className="mb-8 print:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Audit Log & Ekspor
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Riwayat Sistem & Ekspor Laporan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Semua aksi administratif, perubahan status, percobaan akses kode, dan transaksi voting tercatat di sini.
        </p>
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

