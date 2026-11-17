"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString, parseAsInteger, parseAsStringLiteral } from "nuqs";
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from "@tanstack/react-table";
import { Download, FileUp, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { mutateVoter, importVoters, exportVoters } from "@/actions/dpt";
import type { Voter } from "@/lib/dpt";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const selectField =
  "h-8 rounded-md border border-border-soft bg-panel px-2.5 text-xs text-foreground outline-none transition focus:border-primary";

export function DptTable({
  rows,
  count,
  elections,
  election,
  closed,
}: {
  rows: Voter[];
  count: number;
  elections: { id: string; nama: string }[];
  election: string;
  closed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [failures, setFailures] = useState<{ line: number; message: string }[]>([]);
  const [editing, setEditing] = useState<Voter | null | undefined>();
  const [importOpen, setImportOpen] = useState(false);

  const [query, setQuery] = useQueryStates(
    {
      pemilu: parseAsString.withDefault(election),
      q: parseAsString.withDefault(""),
      kelompok: parseAsString.withDefault(""),
      status: parseAsStringLiteral(["semua", "sudah", "belum"] as const).withDefault("semua"),
      sort: parseAsStringLiteral(["nama", "kelompok", "kode_unik", "has_voted", "voted_at"] as const).withDefault("nama"),
      arah: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
      page: parseAsInteger.withDefault(1),
      size: parseAsInteger.withDefault(25),
    },
    { shallow: false, history: "push" }
  );

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch {
        setMessage("Permintaan gagal. Periksa koneksi dan coba lagi.");
      }
    });

  const mutate = async (input: unknown) => {
    const r = await mutateVoter(input);
    setMessage(r.message);
    if (r.ok) {
      setEditing(undefined);
      router.refresh();
    }
    return r;
  };

  const download = (text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "dpt-kode.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const columns: ColumnDef<Voter>[] = [
    { accessorKey: "nama", header: "Nama Lengkap" },
    { accessorKey: "kelompok", header: "Kelompok / Kelas", cell: (c) => String(c.getValue() ?? "—") },
    {
      accessorKey: "kode_unik",
      header: "Kode Unik",
      cell: (c) => (
        <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-xs font-semibold">
          {String(c.getValue())}
        </code>
      ),
    },
    {
      accessorKey: "has_voted",
      header: "Status Hak Suara",
      cell: (c) => (
        <Badge
          variant={c.getValue() ? "default" : "secondary"}
          className={`text-[10px] whitespace-nowrap uppercase font-semibold ${
            c.getValue() ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
          }`}
        >
          {c.getValue() ? "Sudah Memilih" : "Belum Memilih"}
        </Badge>
      ),
    },
    {
      accessorKey: "voted_at",
      header: "Waktu Memilih",
      cell: (c) =>
        c.getValue()
          ? new Date(String(c.getValue())).toLocaleString("id-ID", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "Asia/Jakarta",
            }) + " WIB"
          : "—",
    },
    {
      id: "aksi",
      header: "Aksi",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || closed || row.original.has_voted}
            onClick={() => setEditing(row.original)}
            className="h-7 px-2 text-xs font-normal"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || closed || row.original.has_voted}
            onClick={() => {
              if (
                confirm(
                  "Reset kode " +
                    row.original.nama +
                    "? Kode lama langsung tidak berlaku. Status hak pilih tetap Belum Memilih."
                )
              )
                run(async () => {
                  await mutate({ action: "reset", election, id: row.original.id });
                });
            }}
            className="h-7 px-2 text-xs font-normal text-amber-600 hover:bg-amber-500/10 hover:text-amber-600"
          >
            <RefreshCw className="mr-1 size-3" /> Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || closed || row.original.has_voted}
            onClick={() => {
              if (confirm("Hapus " + row.original.nama + " dari DPT?"))
                run(async () => {
                  await mutate({ action: "delete", election, id: row.original.id });
                });
            }}
            className="h-7 px-2 text-xs font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  return (
    <div className="w-full min-w-0 space-y-3">
      {/* Top Controls Toolbar (High Density) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border-soft pb-2.5">
        <div className="flex items-center gap-2">
          <label htmlFor="election-select" className="text-xs font-medium text-muted-foreground shrink-0">
            Pilih Pemilu:
          </label>
          <select
            id="election-select"
            className={selectField}
            value={query.pemilu}
            onChange={(e) => void setQuery({ pemilu: e.target.value, page: 1 })}
          >
            {elections.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nama}
              </option>
            ))}
          </select>
          <Badge variant="outline" className="text-xs font-normal shrink-0">
            {count.toLocaleString("id-ID")} Pemilih
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={pending || closed}
            onClick={() => setEditing(null)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" />
            <span>Tambah Pemilih</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || closed}
            onClick={() => setImportOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <FileUp className="size-3.5" />
            <span>Impor CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                download(await exportVoters(election));
                setMessage("Ekspor seluruh DPT selesai.");
              })
            }
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Download className="size-3.5" />
            <span>Ekspor CSV</span>
          </Button>
        </div>
      </div>

      {message && (
        <Alert role="status" aria-live="polite" className="py-2.5">
          <AlertDescription className="text-xs">{pending ? "Memproses…" : message}</AlertDescription>
        </Alert>
      )}

      {/* Main Table Card (W-full, high density) */}
      <Card className="w-full min-w-0 border-border-soft p-3">
        {/* Search & Filter Row */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void setQuery({ q: String(f.get("q")), kelompok: String(f.get("kelompok")), page: 1 });
            }}
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                key={"q" + query.q}
                name="q"
                aria-label="Cari nama"
                placeholder="Cari nama pemilih..."
                defaultValue={query.q}
                className="h-8 w-48 pl-8 text-xs bg-panel"
              />
            </div>
            <Input
              key={"g" + query.kelompok}
              name="kelompok"
              aria-label="Filter kelompok"
              placeholder="Kelompok / Kelas"
              defaultValue={query.kelompok}
              className="h-8 w-36 text-xs bg-panel"
            />
            <Button variant="outline" size="sm" type="submit" className="h-8 text-xs px-2.5">
              Cari
            </Button>
          </form>

          <select
            aria-label="Status memilih"
            className={selectField}
            value={query.status}
            onChange={(e) => void setQuery({ status: e.target.value as typeof query.status, page: 1 })}
          >
            <option value="semua">Semua Status</option>
            <option value="sudah">Sudah Memilih</option>
            <option value="belum">Belum Memilih</option>
          </select>
        </div>

        {/* Dense Table */}
        <div className="rounded-md border border-border-soft overflow-x-auto w-full">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((h) => (
                    <TableHead key={h.id} className="h-9 py-1 text-xs">
                      {h.column.getCanSort() ? (
                        <button
                          className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition"
                          onClick={() =>
                            void setQuery({
                              sort: h.column.id as typeof query.sort,
                              arah: query.sort === h.column.id && query.arah === "asc" ? "desc" : "asc",
                              page: 1,
                            })
                          }
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}{" "}
                          <span className="text-[10px] text-muted-foreground">
                            {query.sort === h.column.id ? (query.arah === "asc" ? "↑" : "↓") : "↕"}
                          </span>
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="h-10 hover:bg-muted/40">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-1.5 text-xs">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {!rows.length && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Tidak ada pemilih pada filter/halaman ini.
          </p>
        )}

        {/* Compact Pagination Footer */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {count.toLocaleString("id-ID")} pemilih · Halaman {query.page} dari{" "}
            {Math.max(1, Math.ceil(count / query.size))}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending || query.page <= 1}
              onClick={() => void setQuery({ page: query.page - 1 })}
              className="h-7 px-2.5 text-xs font-normal"
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || query.page * query.size >= count}
              onClick={() => void setQuery({ page: query.page + 1 })}
              className="h-7 px-2.5 text-xs font-normal"
            >
              Berikutnya
            </Button>
            <select
              aria-label="Jumlah baris"
              className={selectField}
              value={query.size}
              onChange={(e) => void setQuery({ size: Number(e.target.value), page: 1 })}
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

      {/* MODAL 1: FORM TAMBAH / EDIT PEMILIH (SHADCN DIALOG) */}
      <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editing ? "Edit Data Pemilih" : "Tambah Pemilih Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editing
                ? "Ubah data nama atau kelompok pemilih."
                : "Kode unik pemilihan akan digenerate otomatis oleh sistem."}
            </DialogDescription>
          </DialogHeader>

          <form
            key={editing?.id ?? "new"}
            className="space-y-3.5 py-1"
            action={(form) =>
              run(async () => {
                await mutate({
                  action: editing ? "edit" : "create",
                  id: editing?.id,
                  election,
                  nama: form.get("nama"),
                  kelompok: form.get("kelompok"),
                });
              })
            }
          >
            <div className="space-y-1.5">
              <Label htmlFor="nama-input" className="text-xs">
                Nama Lengkap
              </Label>
              <Input
                id="nama-input"
                name="nama"
                required
                minLength={2}
                maxLength={160}
                defaultValue={editing?.nama}
                placeholder="Contoh: Muhammad Haziq"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kelompok-input" className="text-xs">
                Kelompok / Kelas / Jurusan
              </Label>
              <Input
                id="kelompok-input"
                name="kelompok"
                maxLength={120}
                defaultValue={editing?.kelompok ?? ""}
                placeholder="Contoh: XII IPA 1"
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(undefined)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={pending} className="text-xs">
                {pending ? "Menyimpan…" : "Simpan Pemilih"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: FORM IMPOR CSV (SHADCN DIALOG) */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Impor DPT via CSV</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Format header CSV: <code>nama,kelompok</code>. Maksimal 5.000 baris atau 2 MB. Baris
              valid akan disimpan dan kode unik akan dibuat otomatis.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3.5 py-1"
            action={(form) =>
              run(async () => {
                const r = await importVoters(election, form);
                setMessage(r.message);
                setFailures(r.failures);
                setImportOpen(false);
                router.refresh();
              })
            }
          >
            <div className="space-y-1.5">
              <Label htmlFor="csv-file" className="text-xs">
                Pilih Berkas CSV
              </Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                name="file"
                required
                disabled={pending || closed}
                className="h-9 text-xs file:text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={pending || closed} className="text-xs">
                {pending ? "Mengimpor…" : "Mulai Impor & Generate Kode"}
              </Button>
            </DialogFooter>
          </form>

          {failures.length > 0 && (
            <Alert variant="destructive" className="mt-2 max-h-48 overflow-auto py-2 text-xs">
              <AlertDescription>
                <ul className="space-y-1">
                  {failures.map((f, i) => (
                    <li key={i}>
                      Baris {f.line}: {f.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
