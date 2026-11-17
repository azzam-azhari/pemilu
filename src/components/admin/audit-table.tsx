"use client";

import { useState, useTransition } from "react";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringLiteral } from "nuqs";
import { Download, FileSpreadsheet, FileText, Printer, Search, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportAuditLogs, exportElectionResults } from "@/actions/audit";
import type { AuditLogItem } from "@/lib/validations/audit";

interface AuditTableProps {
  rows: AuditLogItem[];
  count: number;
  actionsList: string[];
  elections: { id: string; nama: string; status: string }[];
}

const selectStyle = "h-9 rounded-md border border-border-soft bg-panel px-3 py-1 text-xs text-foreground outline-none transition focus:border-primary";

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
    <div className="w-full min-w-0 space-y-3">
      {/* Top Action / Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-2.5 print:hidden">
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
              className={selectStyle}
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
      <Card className="rounded-card border border-border-soft bg-panel/30 p-3 print:hidden">
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
          <div className="grid gap-1">
            <Label htmlFor="audit-q" className="text-xs">Pencarian</Label>
            <div className="relative">
              <Input
                id="audit-q"
                key={"q" + query.q}
                name="q"
                defaultValue={query.q}
                placeholder="Cari aksi, aktor, atau IP..."
                className="w-60 bg-panel pl-8 text-xs"
              />
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            </div>
          </div>

          <div className="grid gap-1">
            <Label htmlFor="audit-filter-aksi" className="text-xs">Filter Aksi</Label>
            <select
              id="audit-filter-aksi"
              value={query.aksi}
              onChange={(e) => void setQuery({ aksi: e.target.value, page: 1 })}
              className={selectStyle}
            >
              <option value="semua">Semua Aksi</option>
              {actionsList.map((a) => (
                <option key={a} value={a}>
                  {a.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <Label htmlFor="audit-dari" className="text-xs">Dari Tanggal</Label>
            <Input
              id="audit-dari"
              type="date"
              value={query.dari}
              onChange={(e) => void setQuery({ dari: e.target.value, page: 1 })}
              className="w-40 bg-panel text-xs"
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="audit-sampai" className="text-xs">Sampai Tanggal</Label>
            <Input
              id="audit-sampai"
              type="date"
              value={query.sampai}
              onChange={(e) => void setQuery({ sampai: e.target.value, page: 1 })}
              className="w-40 bg-panel text-xs"
            />
          </div>

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
      <Card className="rounded-card border border-border-soft overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow className="bg-panel/50">
                <TableHead className="pl-6">Waktu (WIB)</TableHead>
                <TableHead>Jenis Aksi</TableHead>
                <TableHead>Aktor</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead className="pr-6">Detail Aktivitas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-8 text-center text-muted-foreground">
                    Tidak ada catatan aktivitas yang sesuai dengan filter.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-6 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jakarta",
                      })}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Badge variant="outline" className="gap-1.5 py-0.5 text-xs">
                        <ShieldAlert className="size-3 text-muted-foreground" />
                        {r.aksi.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{r.aktor}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {r.ip ?? "—"}
                    </TableCell>
                    <TableCell className="pr-6 text-xs text-muted-foreground font-mono max-w-xs sm:max-w-md truncate">
                      {JSON.stringify(r.detail ?? {})}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
              className={selectStyle}
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
