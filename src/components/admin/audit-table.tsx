"use client";

import { useState, useTransition } from "react";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringLiteral } from "nuqs";
import { Download, FileSpreadsheet, FileText, Printer, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { exportAuditLogs, exportElectionResults } from "@/actions/audit";
import type { AuditLogItem } from "@/lib/validations/audit";

interface AuditTableProps {
  rows: AuditLogItem[];
  count: number;
  actionsList: string[];
  elections: { id: string; nama: string; status: string }[];
}

const field = "rounded-input border border-border-soft bg-panel p-2.5 text-xs text-foreground";

export function AuditTable({ rows, count, actionsList, elections }: AuditTableProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedElection, setSelectedElection] = useState<string>(elections[0]?.id ?? "");

  const [query, setQuery] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      aksi: parseAsString.withDefault("semua"),
      aktor: parseAsString.withDefault("semua"),
      dari: parseAsString.withDefault(""),
      sampai: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
      size: parseAsInteger.withDefault(25),
      sort: parseAsStringLiteral(["created_at", "aksi", "aktor"] as const).withDefault("created_at"),
      arah: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
    },
    { shallow: false, history: "push" }
  );

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportLogs = (format: "csv" | "excel") => {
    startTransition(async () => {
      const result = await exportAuditLogs(query, format);
      if (format === "csv") {
        downloadFile(result, `audit-log-${Date.now()}.csv`, "text/csv;charset=utf-8");
      } else {
        downloadFile(result, `audit-log-${Date.now()}.xls`, "application/vnd.ms-excel;charset=utf-8");
      }
    });
  };

  const handleExportResults = (format: "csv" | "excel") => {
    if (!selectedElection) return;
    startTransition(async () => {
      const result = await exportElectionResults(selectedElection, format);
      if (format === "csv") {
        downloadFile(result, `hasil-pemilu-${Date.now()}.csv`, "text/csv;charset=utf-8");
      } else {
        downloadFile(result, `hasil-pemilu-${Date.now()}.xls`, "application/vnd.ms-excel;charset=utf-8");
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Action / Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-soft pb-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportLogs("csv")}
            disabled={isPending}
            className="gap-1.5 text-xs"
          >
            <Download className="size-3.5" /> Ekspor Log CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportLogs("excel")}
            disabled={isPending}
            className="gap-1.5 text-xs"
          >
            <FileSpreadsheet className="size-3.5" /> Ekspor Log Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs"
          >
            <Printer className="size-3.5" /> Cetak / Simpan PDF
          </Button>
        </div>

        {/* Export Election Results Section */}
        {elections.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedElection}
              onChange={(e) => setSelectedElection(e.target.value)}
              className={field}
            >
              {elections.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nama} ({e.status})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => handleExportResults("csv")}
              disabled={isPending}
              className="gap-1.5 text-xs"
            >
              <FileText className="size-3.5" /> Ekspor Hasil CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleExportResults("excel")}
              disabled={isPending}
              className="gap-1.5 text-xs"
            >
              <FileSpreadsheet className="size-3.5" /> Ekspor Hasil Excel
            </Button>
          </div>
        )}
      </div>

      {/* Filter Card */}
      <Card className="rounded-[24px] p-5 border border-border-soft bg-panel/30 print:hidden">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void setQuery({
              q: String(f.get("q") ?? ""),
              page: 1,
            });
          }}
        >
          <label className="grid gap-1 text-xs font-medium">
            Pencarian
            <div className="relative">
              <input
                key={"q" + query.q}
                name="q"
                defaultValue={query.q}
                placeholder="Cari aksi, aktor, atau IP..."
                className={`${field} pl-8 w-60`}
              />
              <Search className="absolute left-2.5 top-3 size-3.5 text-muted-foreground" />
            </div>
          </label>

          <label className="grid gap-1 text-xs font-medium">
            Filter Aksi
            <select
              value={query.aksi}
              onChange={(e) => void setQuery({ aksi: e.target.value, page: 1 })}
              className={field}
            >
              <option value="semua">Semua Aksi</option>
              {actionsList.map((a) => (
                <option key={a} value={a}>
                  {a.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-medium">
            Dari Tanggal
            <input
              type="date"
              value={query.dari}
              onChange={(e) => void setQuery({ dari: e.target.value, page: 1 })}
              className={field}
            />
          </label>

          <label className="grid gap-1 text-xs font-medium">
            Sampai Tanggal
            <input
              type="date"
              value={query.sampai}
              onChange={(e) => void setQuery({ sampai: e.target.value, page: 1 })}
              className={field}
            />
          </label>

          <Button type="submit" size="sm" variant="secondary" className="text-xs">
            Terapkan
          </Button>

          {(query.q || query.aksi !== "semua" || query.dari || query.sampai) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                void setQuery({
                  q: "",
                  aksi: "semua",
                  dari: "",
                  sampai: "",
                  page: 1,
                })
              }
              className="text-xs text-muted-foreground"
            >
              Reset Filter
            </Button>
          )}
        </form>
      </Card>

      {/* Printable Report Header (Visible only when printing) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">LAPORAN AUDIT LOG & AKTIVITAS SISTEM</h1>
        <p className="text-xs text-muted-foreground">
          Dicetak pada: {new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
        </p>
      </div>

      {/* Audit Log Table */}
      <Card className="rounded-[24px] border border-border-soft overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border-soft bg-panel/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-4 pl-6">Waktu (WIB)</th>
                <th className="p-4">Jenis Aksi</th>
                <th className="p-4">Aktor</th>
                <th className="p-4">IP Address</th>
                <th className="p-4 pr-6">Detail Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Tidak ada catatan aktivitas yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-panel/20 transition-colors">
                    <td className="p-4 pl-6 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      })}
                    </td>
                    <td className="p-4 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 text-xs">
                        <ShieldAlert className="size-3 text-muted-foreground" />
                        {r.aksi.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-xs">{r.aktor}</td>
                    <td className="p-4 whitespace-nowrap text-xs text-muted-foreground">
                      {r.ip ?? "—"}
                    </td>
                    <td className="p-4 pr-6 text-xs text-muted-foreground font-mono max-w-xs sm:max-w-md truncate">
                      {JSON.stringify(r.detail ?? {})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-soft p-4 pl-6 pr-6 text-xs text-muted-foreground print:hidden">
          <div>
            Menampilkan {rows.length} dari {count} riwayat aktivitas
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={query.page <= 1}
              onClick={() => void setQuery({ page: query.page - 1 })}
              className="text-xs"
            >
              Sebelumnya
            </Button>
            <span>
              Halaman {query.page} dari {Math.max(1, Math.ceil(count / query.size))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={query.page * query.size >= count}
              onClick={() => void setQuery({ page: query.page + 1 })}
              className="text-xs"
            >
              Berikutnya
            </Button>
            <select
              value={query.size}
              onChange={(e) => void setQuery({ size: Number(e.target.value), page: 1 })}
              className={field}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / halaman
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>
    </div>
  );
}

