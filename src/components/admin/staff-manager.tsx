"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, Monitor, Trash2, Edit3, UserCheck } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mutateStaff, mutateBooth } from "@/actions/staff";
import type { BoothItem, StaffItem } from "@/lib/validations/staff";

interface StaffManagerProps {
  elections: { id: string; nama: string; status: string }[];
  booths: BoothItem[];
  staff: StaffItem[];
  currentElectionId: string;
}

const statusConfig = {
  kosong: { label: "Kosong / Siap", dot: "bg-emerald-600" },
  terpakai: { label: "Sedang Digunakan", dot: "bg-amber-500" },
  nonaktif: { label: "Nonaktif", dot: "bg-outline" },
};

const selectStyle = "h-11 w-full rounded-md border border-border-soft bg-background px-3 py-2 text-sm outline-none transition focus:border-primary";

export function StaffManager({
  elections,
  booths,
  staff,
  currentElectionId,
}: StaffManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<string>("staff");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  // Modal / Form state for Staff
  const [staffEditing, setStaffEditing] = useState<StaffItem | null | "new">(null);
  const [staffName, setStaffName] = useState("");
  const [staffBoothId, setStaffBoothId] = useState<string>("");

  // Modal / Form state for Booth
  const [boothEditing, setBoothEditing] = useState<BoothItem | null | "new">(null);
  const [boothName, setBoothName] = useState("");
  const [boothStatus, setBoothStatus] = useState<"kosong" | "terpakai" | "nonaktif">("kosong");

  const openStaffEditor = (item?: StaffItem) => {
    setMessage(null);
    if (item) {
      setStaffEditing(item);
      setStaffName(item.nama);
      setStaffBoothId(item.booth_id ?? "");
    } else {
      setStaffEditing("new");
      setStaffName("");
      setStaffBoothId("");
    }
  };

  const openBoothEditor = (item?: BoothItem) => {
    setMessage(null);
    if (item) {
      setBoothEditing(item);
      setBoothName(item.nama);
      setBoothStatus(item.status);
    } else {
      setBoothEditing("new");
      setBoothName("");
      setBoothStatus("kosong");
    }
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const isNew = staffEditing === "new";
      const res = await mutateStaff(isNew ? "create" : "edit", {
        id: !isNew && typeof staffEditing === "object" ? staffEditing?.id : undefined,
        nama: staffName,
        booth_id: staffBoothId || null,
      });

      if (res.ok) {
        setMessage({ text: res.message });
        setStaffEditing(null);
        router.refresh();
      } else {
        setMessage({ text: res.message, error: true });
      }
    });
  };

  const handleStaffDelete = (item: StaffItem) => {
    if (!confirm(`Hapus data petugas "${item.nama}"?`)) return;
    startTransition(async () => {
      const res = await mutateStaff("delete", { id: item.id });
      if (res.ok) {
        setMessage({ text: res.message });
        router.refresh();
      } else {
        setMessage({ text: res.message, error: true });
      }
    });
  };

  const handleBoothSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const isNew = boothEditing === "new";
      const res = await mutateBooth(isNew ? "create" : "edit", {
        id: !isNew && typeof boothEditing === "object" ? boothEditing?.id : undefined,
        election_id: currentElectionId,
        nama: boothName,
        status: boothStatus,
      });

      if (res.ok) {
        setMessage({ text: res.message });
        setBoothEditing(null);
        router.refresh();
      } else {
        setMessage({ text: res.message, error: true });
      }
    });
  };

  const handleBoothDelete = (item: BoothItem) => {
    if (!confirm(`Hapus bilik "${item.nama}"? Penugasan petugas pada bilik ini akan dikosongkan.`)) return;
    startTransition(async () => {
      const res = await mutateBooth("delete", { id: item.id });
      if (res.ok) {
        setMessage({ text: res.message });
        router.refresh();
      } else {
        setMessage({ text: res.message, error: true });
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Election Selector & Status */}
      {elections.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-muted-foreground">Pilih Pemilu:</span>
          {elections.map((el) => (
            <a
              key={el.id}
              href={`/admin/petugas?election=${el.id}`}
              className={`rounded-md px-3.5 py-1 font-medium transition-colors ${
                el.id === currentElectionId
                  ? "bg-primary text-primary-foreground"
                  : "border border-border-soft bg-panel text-muted-foreground hover:text-foreground"
              }`}
            >
              {el.nama} ({el.status})
            </a>
          ))}
        </div>
      )}

      {/* Alert status message */}
      {message && (
        <Alert variant={message.error ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-soft pb-4">
          <TabsList className="rounded-md">
            <TabsTrigger value="staff" className="gap-2 rounded-md text-xs">
              <ShieldCheck className="size-3.5" />
              Daftar Petugas ({staff.length})
            </TabsTrigger>
            <TabsTrigger value="booths" className="gap-2 rounded-md text-xs">
              <Monitor className="size-3.5" />
              Daftar Bilik ({booths.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === "staff" ? (
            <Button size="sm" onClick={() => openStaffEditor()} className="gap-1.5 text-xs">
              <Plus className="size-3.5" /> Tambah Petugas
            </Button>
          ) : (
            <Button size="sm" onClick={() => openBoothEditor()} className="gap-1.5 text-xs">
              <Plus className="size-3.5" /> Tambah Bilik
            </Button>
          )}
        </div>

        {/* Staff Tab Content */}
        <TabsContent value="staff" className="space-y-6">
          <Card className="rounded-card border border-border-soft overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-panel/50">
                    <TableHead className="pl-6">Nama Petugas</TableHead>
                    <TableHead>Bilik Penugasan</TableHead>
                    <TableHead>Status Bilik</TableHead>
                    <TableHead className="pr-6 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="p-8 text-center text-muted-foreground">
                        Belum ada petugas yang tercatat. Silakan klik &quot;Tambah Petugas&quot;.
                      </TableCell>
                    </TableRow>
                  ) : (
                    staff.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="pl-6 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="grid size-7 place-items-center rounded-md bg-panel text-muted-foreground">
                              <UserCheck className="size-3.5" />
                            </span>
                            {s.nama}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.booth_name ?? <span className="text-xs italic">Belum ditentukan</span>}
                        </TableCell>
                        <TableCell>
                          {s.booth_status ? (
                            <Badge variant="outline" className="gap-1.5 py-0.5 text-xs font-normal">
                              <span className={`size-2 rounded-full ${statusConfig[s.booth_status].dot}`} />
                              {statusConfig[s.booth_status].label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openStaffEditor(s)}
                              disabled={isPending}
                              className="size-8 p-0"
                              title="Edit Petugas"
                            >
                              <Edit3 className="size-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStaffDelete(s)}
                              disabled={isPending}
                              className="size-8 p-0 text-error hover:bg-error/10 hover:text-error"
                              title="Hapus Petugas"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Booths Tab Content */}
        <TabsContent value="booths" className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {booths.length === 0 ? (
              <Card className="col-span-full rounded-card p-12 text-center text-muted-foreground">
                Belum ada bilik suara untuk pemilu ini. Silakan klik &quot;Tambah Bilik&quot;.
              </Card>
            ) : (
              booths.map((b) => (
                <Card key={b.id} className="rounded-card border border-border-soft p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 rounded-md bg-panel px-3 py-1 text-xs font-semibold">
                        <Monitor className="size-3.5 text-muted-foreground" />
                        {b.nama}
                      </span>
                      <Badge variant="outline" className="gap-1.5 py-0.5 text-xs font-normal">
                        <span className={`size-2 rounded-full ${statusConfig[b.status].dot}`} />
                        {statusConfig[b.status].label}
                      </Badge>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground">Petugas yang berjaga:</p>
                      <p className="mt-0.5 text-sm font-medium">
                        {b.staff_name ?? <span className="italic text-muted-foreground">Belum ditugaskan</span>}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-2 border-t border-border-soft pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openBoothEditor(b)}
                      disabled={isPending}
                      className="text-xs"
                    >
                      <Edit3 className="mr-1 size-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBoothDelete(b)}
                      disabled={isPending}
                      className="text-xs text-error hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 className="mr-1 size-3.5" /> Hapus
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Staff Editor Dialog */}
      <Dialog open={staffEditing !== null} onOpenChange={(open) => !open && setStaffEditing(null)}>
        <DialogContent className="rounded-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {staffEditing === "new" ? "Tambah Data Petugas" : "Edit Data Petugas"}
            </DialogTitle>
            <DialogDescription>
              Petugas bertugas memfasilitasi jalannya pemungutan suara di bilik (tanpa akses login admin).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="staff-name">Nama Petugas</Label>
              <Input
                id="staff-name"
                required
                minLength={2}
                maxLength={160}
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Masukkan nama lengkap petugas"
                className="h-11 bg-panel"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="staff-booth">Penempatan Bilik</Label>
              <select
                id="staff-booth"
                value={staffBoothId}
                onChange={(e) => setStaffBoothId(e.target.value)}
                className={selectStyle}
              >
                <option value="">— Belum Ditempatkan —</option>
                {booths.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nama} ({statusConfig[b.status].label})
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter className="mt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setStaffEditing(null)} disabled={isPending}>
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan…" : "Simpan Petugas"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Booth Editor Dialog */}
      <Dialog open={boothEditing !== null} onOpenChange={(open) => !open && setBoothEditing(null)}>
        <DialogContent className="rounded-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {boothEditing === "new" ? "Tambah Bilik Suara" : "Edit Bilik Suara"}
            </DialogTitle>
            <DialogDescription>
              Bilik suara dipakai oleh pemilih di lokasi pemungutan suara fisik.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBoothSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="booth-name">Nama Bilik</Label>
              <Input
                id="booth-name"
                required
                minLength={2}
                maxLength={120}
                value={boothName}
                onChange={(e) => setBoothName(e.target.value)}
                placeholder="Contoh: Bilik 1, Bilik A"
                className="h-11 bg-panel"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="booth-status">Status Bilik</Label>
              <select
                id="booth-status"
                value={boothStatus}
                onChange={(e) => setBoothStatus(e.target.value as typeof boothStatus)}
                className={selectStyle}
              >
                <option value="kosong">Kosong / Siap</option>
                <option value="terpakai">Sedang Digunakan</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>
            <DialogFooter className="mt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setBoothEditing(null)} disabled={isPending}>
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan…" : "Simpan Bilik"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
