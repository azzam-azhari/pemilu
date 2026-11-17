"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileText,
  Lock,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  Eye,
} from "lucide-react";

import { change, manage } from "@/actions/management";
import { managementSchema, type ManagementInput } from "@/lib/validations/management";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

export type CandidateRow = {
  id: string;
  position_id: string;
  no_urut: number;
  nama: string;
  info?: string | null;
  visi_misi?: string | null;
  foto?: string | null;
};

interface CandidateManagerProps {
  positionId: string;
  positionName: string;
  rows: CandidateRow[];
  locked?: boolean;
}

export function CandidateManager({
  positionId,
  positionName,
  rows,
  locked = false,
}: CandidateManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Modal dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateRow | null>(null);
  const [viewVisiMisi, setViewVisiMisi] = useState<CandidateRow | null>(null);

  // File preview
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManagementInput>({
    resolver: zodResolver(managementSchema),
    defaultValues: {
      entity: "candidates",
      parent: positionId,
      nama: "",
      nomor: 1,
      mulai: "",
      selesai: "",
      info: "",
      visi_misi: "",
    },
  });

  const openAddModal = () => {
    setEditingCandidate(null);
    setFile(null);
    setPreviewUrl(null);
    setMessage(null);
    const nextNumber = rows.length > 0 ? Math.max(...rows.map((r) => r.no_urut || 0)) + 1 : 1;
    reset({
      entity: "candidates",
      parent: positionId,
      nama: "",
      nomor: nextNumber,
      mulai: "",
      selesai: "",
      info: "",
      visi_misi: "",
    });
    setDialogOpen(true);
  };

  const openEditModal = (candidate: CandidateRow) => {
    setEditingCandidate(candidate);
    setFile(null);
    setPreviewUrl(candidate.foto ?? null);
    setMessage(null);
    reset({
      entity: "candidates",
      parent: positionId,
      id: candidate.id,
      nama: candidate.nama,
      nomor: candidate.no_urut,
      mulai: "",
      selesai: "",
      info: candidate.info ?? "",
      visi_misi: candidate.visi_misi ?? "",
    });
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    }
  };

  const onSubmit = async (values: ManagementInput) => {
    setMessage(null);
    const fd = new FormData();
    if (file) fd.set("foto", file);

    const result = await manage(values, fd);
    if (result.ok) {
      setDialogOpen(false);
      router.refresh();
      setMessage({ text: result.message });
    } else {
      setMessage({ text: result.message, isError: true });
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Hapus kandidat "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    startTransition(async () => {
      const res = await change({ entity: "candidates", id });
      if (res.ok) {
        router.refresh();
        setMessage({ text: res.message });
      } else {
        setMessage({ text: res.message, isError: true });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">
            Kandidat: <span className="font-semibold text-primary">{positionName}</span>
          </p>
          <Badge variant="outline" className="text-xs font-normal">
            {rows.length} Kandidat
          </Badge>
          {locked && (
            <Badge variant="secondary" className="gap-1 text-xs text-amber-700 dark:text-amber-400">
              <Lock className="size-3" /> Terkunci
            </Badge>
          )}
        </div>

        <Button
          size="sm"
          onClick={openAddModal}
          disabled={locked || pending}
          className="h-8 gap-1.5 text-xs font-medium"
        >
          <Plus className="size-3.5" />
          <span>Tambah Kandidat</span>
        </Button>
      </div>

      {/* Global alert messages */}
      {message && (
        <Alert variant={message.isError ? "destructive" : "default"} className="py-2.5">
          <AlertDescription className="text-xs">{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Grid Card Kandidat */}
      {rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {rows.map((cand) => (
            <Card
              key={cand.id}
              className="flex flex-col justify-between overflow-hidden border border-border-soft p-0 transition-all hover:border-outline/40 hover:shadow-sm"
            >
              <div>
                {/* Visual Cover / Foto Portret */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/60">
                  {cand.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cand.foto}
                      alt={cand.nama}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground/60">
                      <UserRound className="size-10 stroke-[1.5]" />
                      <span className="text-[11px] font-medium tracking-wide">Belum ada foto</span>
                    </div>
                  )}

                  {/* Badge Nomor Urut Melayang */}
                  <div className="absolute top-2.5 left-2.5">
                    <Badge className="bg-background/90 text-foreground font-semibold text-xs shadow-xs backdrop-blur-md">
                      No. {String(cand.no_urut).padStart(2, "0")}
                    </Badge>
                  </div>
                </div>

                {/* Info & Deskripsi Kandidat */}
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-semibold leading-snug line-clamp-1">
                    {cand.nama}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                    {cand.info || "Calon " + positionName}
                  </CardDescription>
                </CardHeader>

                {/* Visi & Misi Box */}
                <CardContent className="px-4 py-2">
                  <div className="rounded-md border border-border-soft bg-panel/50 p-2.5 text-xs">
                    <div className="mb-1 flex items-center justify-between font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <FileText className="size-3 text-muted-foreground" />
                        Visi & Misi
                      </span>
                      {cand.visi_misi && cand.visi_misi.length > 90 ? (
                        <button
                          type="button"
                          onClick={() => setViewVisiMisi(cand)}
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <Eye className="size-3" /> Detail
                        </button>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-muted-foreground leading-relaxed whitespace-pre-line">
                      {cand.visi_misi || "Belum ada catatan visi & misi."}
                    </p>
                  </div>
                </CardContent>
              </div>

              {/* Action Buttons Footer */}
              <CardFooter className="flex items-center justify-end gap-2 border-t border-border-soft bg-panel/30 px-4 py-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={locked || pending}
                  onClick={() => openEditModal(cand)}
                  className="h-7 px-2.5 text-xs font-normal"
                >
                  <Pencil className="mr-1 size-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={locked || pending}
                  onClick={() => handleDelete(cand.id, cand.nama)}
                  className="h-7 px-2.5 text-xs font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-1 size-3" />
                  Hapus
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
          <div className="grid size-12 place-items-center rounded-full bg-muted/70 text-muted-foreground">
            <UserRound className="size-6" />
          </div>
          <h3 className="mt-3 text-base font-medium">Belum ada kandidat</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            Tambahkan kandidat untuk jabatan {positionName} agar dapat dipilih oleh pemilih pada saat pemungutan suara.
          </p>
          {!locked && (
            <Button size="sm" onClick={openAddModal} className="mt-4 gap-1.5 text-xs font-medium">
              <Plus className="size-3.5" />
              <span>Tambah Kandidat Pertama</span>
            </Button>
          )}
        </Card>
      )}

      {/* Dialog Modal: Tambah & Edit Kandidat */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingCandidate ? "Edit Data Kandidat" : "Tambah Kandidat Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan informasi kandidat untuk jabatan <strong>{positionName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="nomor" className="text-xs">
                  No. Urut
                </Label>
                <Input
                  id="nomor"
                  type="number"
                  min={1}
                  className="h-9 text-xs"
                  {...register("nomor", { valueAsNumber: true })}
                />
                {errors.nomor && (
                  <p className="text-[11px] text-destructive">{errors.nomor.message}</p>
                )}
              </div>

              <div className="col-span-3 space-y-1.5">
                <Label htmlFor="nama" className="text-xs">
                  Nama Lengkap
                </Label>
                <Input
                  id="nama"
                  placeholder="Contoh: Ahmad Dahlan"
                  className="h-9 text-xs"
                  {...register("nama")}
                />
                {errors.nama && (
                  <p className="text-[11px] text-destructive">{errors.nama.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="info" className="text-xs">
                Info Singkat / Organisasi
              </Label>
              <Input
                id="info"
                placeholder="Contoh: Jurusan Teknik Informatika, Semester 5"
                className="h-9 text-xs"
                {...register("info")}
              />
              {errors.info && (
                <p className="text-[11px] text-destructive">{errors.info.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="visi_misi" className="text-xs">
                Visi & Misi
              </Label>
              <Textarea
                id="visi_misi"
                rows={4}
                placeholder="Tuliskan poin-poin visi & misi kandidat di sini..."
                className="text-xs leading-relaxed"
                {...register("visi_misi")}
              />
              {errors.visi_misi && (
                <p className="text-[11px] text-destructive">{errors.visi_misi.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="foto" className="text-xs">
                Foto Portret (Maksimal 5 MB, JPEG/PNG/WebP)
              </Label>
              <div className="flex items-center gap-3">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="size-12 rounded-md object-cover border border-border-soft"
                  />
                ) : (
                  <div className="grid size-12 place-items-center rounded-md border border-dashed border-border-soft bg-muted/40 text-muted-foreground">
                    <UserRound className="size-5" />
                  </div>
                )}
                <Input
                  id="foto"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="h-9 flex-1 text-xs file:text-xs"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs">
                {isSubmitting ? "Menyimpan…" : "Simpan Data"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Modal: Baca Visi Misi Lengkap */}
      <Dialog open={!!viewVisiMisi} onOpenChange={(open) => !open && setViewVisiMisi(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Badge variant="outline">No. {viewVisiMisi?.no_urut}</Badge>
              {viewVisiMisi?.nama}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Visi & Misi untuk jabatan {positionName}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border-soft bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
            {viewVisiMisi?.visi_misi || "Belum ada visi misi."}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewVisiMisi(null)}
              className="text-xs"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
