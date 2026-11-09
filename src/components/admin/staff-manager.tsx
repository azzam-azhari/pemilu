"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, Monitor, Trash2, Edit3, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function StaffManager({
  elections,
  booths,
  staff,
  currentElectionId,
}: StaffManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"staff" | "booths">("staff");
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
          <span className="text-muted-foreground font-medium">Pilih Pemilu:</span>
          {elections.map((el) => (
            <a
              key={el.id}
              href={`/admin/petugas?election=${el.id}`}
              className={`rounded-full px-3.5 py-1 font-medium transition-colors ${
                el.id === currentElectionId
                  ? "bg-primary text-primary-foreground"
                  : "bg-panel text-muted-foreground hover:text-foreground border border-border-soft"
              }`}
            >
              {el.nama} ({el.status})
            </a>
          ))}
        </div>
      )}

      {/* Alert status message */}
      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            message.error
              ? "border-error/30 bg-error/10 text-error"
              : "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-border-soft pb-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-medium transition-all ${
              activeTab === "staff"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border-soft bg-panel text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="size-3.5" />
            Daftar Petugas ({staff.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("booths")}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-medium transition-all ${
              activeTab === "booths"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border-soft bg-panel text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="size-3.5" />
            Daftar Bilik ({booths.length})
          </button>
        </div>

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
      {activeTab === "staff" && (
        <div className="space-y-6">
          {/* Staff Editor Form Card */}
          {staffEditing !== null && (
            <Card className="rounded-[24px] p-6 border border-border-soft bg-panel/40">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">
                  {staffEditing === "new" ? "Tambah Data Petugas" : "Edit Data Petugas"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Petugas bertugas memfasilitasi jalannya pemungutan suara di bilik (tanpa akses login admin).
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleStaffSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium">
                    Nama Petugas
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={160}
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="Masukkan nama lengkap petugas"
                      className="rounded-input border border-border-soft bg-background p-3 text-sm"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium">
                    Penempatan Bilik
                    <select
                      value={staffBoothId}
                      onChange={(e) => setStaffBoothId(e.target.value)}
                      className="rounded-input border border-border-soft bg-background p-3 text-sm"
                    >
                      <option value="">— Belum Ditempatkan —</option>
                      {booths.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nama} ({statusConfig[b.status].label})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? "Menyimpan…" : "Simpan Petugas"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStaffEditing(null)}
                    disabled={isPending}
                  >
                    Batal
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Staff Table */}
          <Card className="rounded-[24px] border border-border-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-soft bg-panel/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="p-4 pl-6">Nama Petugas</th>
                    <th className="p-4">Bilik Penugasan</th>
                    <th className="p-4">Status Bilik</th>
                    <th className="p-4 pr-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {staff.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        Belum ada petugas yang tercatat. Silakan klik &quot;Tambah Petugas&quot;.
                      </td>
                    </tr>
                  ) : (
                    staff.map((s) => (
                      <tr key={s.id} className="hover:bg-panel/20 transition-colors">
                        <td className="p-4 pl-6 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="grid size-7 place-items-center rounded-full bg-panel text-muted-foreground">
                              <UserCheck className="size-3.5" />
                            </span>
                            {s.nama}
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {s.booth_name ?? <span className="italic text-xs">Belum ditentukan</span>}
                        </td>
                        <td className="p-4">
                          {s.booth_status ? (
                            <span className="flex items-center gap-2 text-xs">
                              <span className={`size-2 rounded-full ${statusConfig[s.booth_status].dot}`} />
                              {statusConfig[s.booth_status].label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right">
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
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Booths Tab Content */}
      {activeTab === "booths" && (
        <div className="space-y-6">
          {/* Booth Editor Form Card */}
          {boothEditing !== null && (
            <Card className="rounded-[24px] p-6 border border-border-soft bg-panel/40">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-lg">
                  {boothEditing === "new" ? "Tambah Bilik Suara" : "Edit Bilik Suara"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Bilik suara dipakai oleh pemilih di lokasi pemungutan suara fisik.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleBoothSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium">
                    Nama Bilik
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      value={boothName}
                      onChange={(e) => setBoothName(e.target.value)}
                      placeholder="Contoh: Bilik 1, Bilik A"
                      className="rounded-input border border-border-soft bg-background p-3 text-sm"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium">
                    Status Bilik
                    <select
                      value={boothStatus}
                      onChange={(e) => setBoothStatus(e.target.value as typeof boothStatus)}
                      className="rounded-input border border-border-soft bg-background p-3 text-sm"
                    >
                      <option value="kosong">Kosong / Siap</option>
                      <option value="terpakai">Sedang Digunakan</option>
                      <option value="nonaktif">Nonaktif</option>
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isPending}>
                    {isPending ? "Menyimpan…" : "Simpan Bilik"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBoothEditing(null)}
                    disabled={isPending}
                  >
                    Batal
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Booths Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {booths.length === 0 ? (
              <Card className="col-span-full rounded-[24px] p-12 text-center text-muted-foreground">
                Belum ada bilik suara untuk pemilu ini. Silakan klik &quot;Tambah Bilik&quot;.
              </Card>
            ) : (
              booths.map((b) => (
                <Card key={b.id} className="rounded-[24px] border border-border-soft p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 rounded-full bg-panel px-3 py-1 text-xs font-semibold">
                        <Monitor className="size-3.5 text-muted-foreground" />
                        {b.nama}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className={`size-2 rounded-full ${statusConfig[b.status].dot}`} />
                        {statusConfig[b.status].label}
                      </span>
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
                      <Edit3 className="size-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBoothDelete(b)}
                      disabled={isPending}
                      className="text-xs text-error hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 className="size-3.5 mr-1" /> Hapus
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
