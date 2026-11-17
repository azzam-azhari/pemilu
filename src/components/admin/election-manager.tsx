"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  GripVertical,
  Layers,
  Lock,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Vote,
} from "lucide-react";

import { change, manage } from "@/actions/management";
import { managementSchema, type ManagementInput } from "@/lib/validations/management";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Card,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ElectionItem = {
  id: string;
  nama: string;
  status: "draft" | "open" | "closed" | string;
  periode_mulai?: string | null;
  periode_selesai?: string | null;
  created_at?: string;
};

export type PositionItem = {
  id: string;
  election_id: string;
  nama_jabatan: string;
  urutan: number;
};

interface ElectionManagerProps {
  elections: ElectionItem[];
  selectedElectionId?: string;
  positions: PositionItem[];
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function SortablePositionCard({
  position,
  disabled,
  onEdit,
  onDelete,
}: {
  position: PositionItem;
  disabled: boolean;
  onEdit: (item: PositionItem) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: position.id,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Card className="flex items-center justify-between p-2.5 px-3 border-border-soft bg-card hover:bg-accent/20 transition-colors">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            {...attributes}
            {...listeners}
            className="size-7 text-muted-foreground touch-none cursor-grab active:cursor-grabbing hover:bg-muted"
            aria-label={"Urutkan " + position.nama_jabatan}
          >
            <GripVertical className="size-4" />
          </Button>

          <Badge variant="outline" className="font-semibold text-xs px-2 h-5 shrink-0">
            #{String(position.urutan).padStart(2, "0")}
          </Badge>

          <span className="text-sm font-medium text-foreground truncate">
            {position.nama_jabatan}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onEdit(position)}
            className="h-7 px-2 text-xs font-normal hover:bg-muted"
          >
            <Pencil className="size-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onDelete(position.id, position.nama_jabatan)}
            className="h-7 px-2 text-xs font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3 mr-1" />
            Hapus
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function ElectionManager({
  elections,
  selectedElectionId,
  positions,
}: ElectionManagerProps) {
  const dndContextId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Modals state
  const [electionModalOpen, setElectionModalOpen] = useState(false);
  const [editingElection, setEditingElection] = useState<ElectionItem | null>(null);

  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PositionItem | null>(null);

  const [statusDialog, setStatusDialog] = useState<{
    election: ElectionItem;
    targetStatus: "draft" | "open" | "closed";
  } | null>(null);

  // Setup form election
  const electionForm = useForm<ManagementInput>({
    resolver: zodResolver(managementSchema),
    defaultValues: {
      entity: "elections",
      nama: "",
      nomor: 1,
      mulai: "",
      selesai: "",
      info: "",
      visi_misi: "",
      status: "draft",
    },
  });

  const currentElectionStatus = useWatch({
    control: electionForm.control,
    name: "status",
  });

  // Setup form position
  const positionForm = useForm<ManagementInput>({
    resolver: zodResolver(managementSchema),
    defaultValues: {
      entity: "positions",
      parent: selectedElectionId,
      nama: "",
      nomor: 1,
      mulai: "",
      selesai: "",
      info: "",
      visi_misi: "",
    },
  });

  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedElection =
    elections.find((e) => e.id === selectedElectionId) ?? elections[0];
  const isLocked = selectedElection?.status !== "draft";

  // Actions for Election
  const openAddElection = () => {
    setEditingElection(null);
    setMessage(null);
    electionForm.reset({
      entity: "elections",
      nama: "",
      nomor: 1,
      mulai: "",
      selesai: "",
      info: "",
      visi_misi: "",
      status: "draft",
    });
    setElectionModalOpen(true);
  };

  const openEditElection = (el: ElectionItem) => {
    setEditingElection(el);
    setMessage(null);
    electionForm.reset({
      entity: "elections",
      id: el.id,
      nama: el.nama,
      nomor: 1,
      mulai: el.periode_mulai?.slice(0, 10) ?? "",
      selesai: el.periode_selesai?.slice(0, 10) ?? "",
      info: "",
      visi_misi: "",
      status: (el.status as "draft" | "open" | "closed") || "draft",
    });
    setElectionModalOpen(true);
  };

  const onElectionSubmit = async (values: ManagementInput) => {
    setMessage(null);
    const result = await manage(values);
    if (result.ok) {
      setElectionModalOpen(false);
      router.refresh();
      setMessage({ text: result.message });
    } else {
      setMessage({ text: result.message, isError: true });
    }
  };

  const handleDeleteElection = (id: string, name: string) => {
    if (!confirm(`Hapus pemilu "${name}" beserta seluruh data jabatan dan kandidat di dalamnya?`))
      return;
    startTransition(async () => {
      const res = await change({ entity: "elections", id });
      if (res.ok) {
        router.refresh();
        setMessage({ text: res.message });
      } else {
        setMessage({ text: res.message, isError: true });
      }
    });
  };

  const confirmStatusChange = () => {
    if (!statusDialog) return;
    const { election, targetStatus } = statusDialog;
    setStatusDialog(null);
    startTransition(async () => {
      const res = await change({
        entity: "elections",
        id: election.id,
        status: targetStatus,
      });
      if (res.ok) {
        router.refresh();
        setMessage({ text: res.message });
      } else {
        setMessage({ text: res.message, isError: true });
      }
    });
  };

  // Actions for Position
  const openAddPosition = () => {
    if (!selectedElection) return;
    setEditingPosition(null);
    setMessage(null);
    const nextOrder = positions.length > 0 ? Math.max(...positions.map((p) => p.urutan || 0)) + 1 : 1;
    positionForm.reset({
      entity: "positions",
      parent: selectedElection.id,
      nama: "",
      nomor: nextOrder,
      mulai: "",
      selesai: "",
      info: "",
      visi_misi: "",
    });
    setPositionModalOpen(true);
  };

  const openEditPosition = (pos: PositionItem) => {
    if (!selectedElection) return;
    setEditingPosition(pos);
    setMessage(null);
    positionForm.reset({
      entity: "positions",
      id: pos.id,
      parent: selectedElection.id,
      nama: pos.nama_jabatan,
      nomor: pos.urutan,
      mulai: "",
      selesai: "",
      info: "",
      visi_misi: "",
    });
    setPositionModalOpen(true);
  };

  const onPositionSubmit = async (values: ManagementInput) => {
    setMessage(null);
    const result = await manage(values);
    if (result.ok) {
      setPositionModalOpen(false);
      router.refresh();
      setMessage({ text: result.message });
    } else {
      setMessage({ text: result.message, isError: true });
    }
  };

  const handleDeletePosition = (id: string, name: string) => {
    if (!confirm(`Hapus jabatan "${name}"? Seluruh kandidat pada jabatan ini akan ikut terhapus.`))
      return;
    startTransition(async () => {
      const res = await change({ entity: "positions", id });
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
      {/* Global Alert Notification */}
      {message && (
        <Alert variant={message.isError ? "destructive" : "default"} className="py-2.5">
          <AlertDescription className="text-xs">{message.text}</AlertDescription>
        </Alert>
      )}

      {/* SECTION 1: DAFTAR PEMILU (HIGH DENSITY GRID) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-border-soft pb-2">
          <div className="flex items-center gap-2">
            <Vote className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Daftar Pemilihan</h2>
            <Badge variant="outline" className="text-xs font-normal">
              {elections.length} Pemilu
            </Badge>
          </div>
          <Button
            size="sm"
            onClick={openAddElection}
            disabled={pending}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" />
            <span>Tambah Pemilu</span>
          </Button>
        </div>

        {elections.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {elections.map((el) => {
              const isSelected = selectedElection?.id === el.id;
              const statusVariant =
                el.status === "open"
                  ? "default"
                  : el.status === "closed"
                  ? "secondary"
                  : "outline";

              return (
                <Card
                  key={el.id}
                  className={`flex flex-col justify-between border p-3.5 transition-all ${
                    isSelected
                      ? "ring-2 ring-primary border-primary shadow-xs bg-card"
                      : "border-border-soft hover:border-outline/50 bg-card/60"
                  }`}
                >
                  <div>
                    {/* Header: Status & Selection Badge */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge
                        variant={statusVariant}
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 ${
                          el.status === "open"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : ""
                        }`}
                      >
                        {el.status === "open"
                          ? "Dibuka"
                          : el.status === "closed"
                          ? "Ditutup"
                          : "Draft"}
                      </Badge>

                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                          <CheckCircle2 className="size-3.5" /> Terpilih
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`?pemilu=${el.id}`)}
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Pilih Jabatan
                        </Button>
                      )}
                    </div>

                    {/* Election Title */}
                    <CardTitle className="text-base font-semibold leading-snug line-clamp-1">
                      {el.nama}
                    </CardTitle>

                    {/* Period Date */}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="size-3.5 text-muted-foreground/70 shrink-0" />
                      <span className="truncate">
                        {el.periode_mulai || el.periode_selesai
                          ? `${formatDate(el.periode_mulai)} — ${formatDate(el.periode_selesai)}`
                          : "Jadwal belum ditentukan"}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-1.5 pt-2.5 border-t border-border-soft">
                    <div className="flex items-center gap-1">
                      {el.status === "draft" && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={pending}
                          onClick={() =>
                            setStatusDialog({ election: el, targetStatus: "open" })
                          }
                          className="h-7 px-2.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Play className="size-3 mr-1" /> Buka
                        </Button>
                      )}

                      {el.status === "open" && (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={pending}
                            onClick={() =>
                              setStatusDialog({ election: el, targetStatus: "closed" })
                            }
                            className="h-7 px-2 text-xs font-medium"
                          >
                            Tutup
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              setStatusDialog({ election: el, targetStatus: "draft" })
                            }
                            className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            Ke Draft
                          </Button>
                        </>
                      )}

                      {el.status === "closed" && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={pending}
                            onClick={() =>
                              setStatusDialog({ election: el, targetStatus: "open" })
                            }
                            className="h-7 px-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <RotateCcw className="size-3 mr-1" /> Buka Kembali
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              setStatusDialog({ election: el, targetStatus: "draft" })
                            }
                            className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            Ke Draft
                          </Button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => openEditElection(el)}
                        className="h-7 px-2 text-xs font-normal"
                      >
                        <Pencil className="size-3 mr-1" /> Edit
                      </Button>

                      {el.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => handleDeleteElection(el.id, el.nama)}
                          className="h-7 px-2 text-xs font-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-6 text-center border-dashed">
            <p className="text-xs text-muted-foreground">Belum ada pemilu yang dibuat.</p>
          </Card>
        )}
      </section>

      {/* SECTION 2: JABATAN UNTUK PEMILU TERPILIH (HIGH DENSITY SORTABLE LIST) */}
      {selectedElection && (
        <section className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft pb-2">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Jabatan Pemilihan: <span className="text-primary">{selectedElection.nama}</span>
              </h2>
              <Badge variant="outline" className="text-xs font-normal">
                {positions.length} Jabatan
              </Badge>
              {isLocked && (
                <Badge variant="secondary" className="gap-1 text-xs text-amber-700 dark:text-amber-400">
                  <Lock className="size-3" /> Terkunci ({selectedElection.status})
                </Badge>
              )}
            </div>

            <Button
              size="sm"
              onClick={openAddPosition}
              disabled={isLocked || pending}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Plus className="size-3.5" />
              <span>Tambah Jabatan</span>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Seret handle <GripVertical className="inline size-3 text-muted-foreground/80" /> untuk
            mengubah urutan jabatan pada bilik suara & surat suara pemilih.
          </p>

          {positions.length > 0 ? (
            <DndContext
              id={dndContextId}
              sensors={sensors}
              onDragEnd={({ active, over }) => {
                if (over && active.id !== over.id) {
                  const ids = arrayMove(
                    positions.map((r) => r.id),
                    positions.findIndex((r) => r.id === active.id),
                    positions.findIndex((r) => r.id === over.id)
                  );
                  startTransition(async () => {
                    const res = await change({
                      entity: "positions",
                      id: selectedElection.id,
                      order: ids,
                    });
                    if (res.ok) {
                      router.refresh();
                    } else {
                      setMessage({ text: res.message, isError: true });
                    }
                  });
                }
              }}
            >
              <SortableContext
                items={positions.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {positions.map((pos) => (
                    <SortablePositionCard
                      key={pos.id}
                      position={pos}
                      disabled={isLocked || pending}
                      onEdit={openEditPosition}
                      onDelete={handleDeletePosition}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <Card className="flex flex-col items-center justify-center p-6 text-center border-dashed">
              <div className="grid size-10 place-items-center rounded-full bg-muted/60 text-muted-foreground">
                <Layers className="size-5" />
              </div>
              <h3 className="mt-2 text-sm font-semibold">Belum Ada Jabatan</h3>
              <p className="mt-0.5 text-xs text-muted-foreground max-w-sm">
                Tambahkan posisi seperti Ketua, Wakil Ketua, atau Sekretaris Jenderal untuk pemilu ini.
              </p>
              {!isLocked && (
                <Button
                  size="sm"
                  onClick={openAddPosition}
                  className="mt-3 gap-1.5 text-xs font-medium"
                >
                  <Plus className="size-3.5" />
                  <span>Tambah Jabatan Pertama</span>
                </Button>
              )}
            </Card>
          )}
        </section>
      )}

      {/* MODAL 1: FORM PEMILU */}
      <Dialog open={electionModalOpen} onOpenChange={setElectionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingElection ? "Edit Data Pemilu" : "Tambah Pemilu Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tentukan nama pemilihan dan jadwal periode pemungutan suara.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={electionForm.handleSubmit(onElectionSubmit)}
            className="space-y-3.5 py-1"
          >
            <div className="space-y-1.5">
              <Label htmlFor="nama-pemilu" className="text-xs">
                Nama Pemilu
              </Label>
              <Input
                id="nama-pemilu"
                placeholder="Contoh: Pemilihan Ketua BEM 2026/2027"
                className="h-9 text-xs"
                {...electionForm.register("nama")}
              />
              {electionForm.formState.errors.nama && (
                <p className="text-[11px] text-destructive">
                  {electionForm.formState.errors.nama.message}
                </p>
              )}
            </div>

            {editingElection && (
              <div className="space-y-1.5">
                <Label htmlFor="status-pemilu" className="text-xs">
                  Status Pemilihan
                </Label>
                <Select
                  value={currentElectionStatus || "draft"}
                  onValueChange={(val) =>
                    electionForm.setValue("status", val as "draft" | "open" | "closed", {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="status-pemilu" className="h-9 text-xs">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft (Persiapan)</SelectItem>
                    <SelectItem value="open">Dibuka (Sedang Berlangsung)</SelectItem>
                    <SelectItem value="closed">Ditutup (Selesai)</SelectItem>
                  </SelectContent>
                </Select>
                {electionForm.formState.errors.status && (
                  <p className="text-[11px] text-destructive">
                    {electionForm.formState.errors.status.message}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mulai-pemilu" className="text-xs">
                  Mulai (WIB)
                </Label>
                <Controller
                  control={electionForm.control}
                  name="mulai"
                  render={({ field, fieldState }) => (
                    <DatePicker
                      id="mulai-pemilu"
                      className="text-xs"
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={fieldState.invalid}
                    />
                  )}
                />
                {electionForm.formState.errors.mulai && (
                  <p className="text-[11px] text-destructive">
                    {electionForm.formState.errors.mulai.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="selesai-pemilu" className="text-xs">
                  Selesai (WIB)
                </Label>
                <Controller
                  control={electionForm.control}
                  name="selesai"
                  render={({ field, fieldState }) => (
                    <DatePicker
                      id="selesai-pemilu"
                      className="text-xs"
                      value={field.value}
                      onChange={field.onChange}
                      aria-invalid={fieldState.invalid}
                    />
                  )}
                />
                {electionForm.formState.errors.selesai && (
                  <p className="text-[11px] text-destructive">
                    {electionForm.formState.errors.selesai.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setElectionModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={electionForm.formState.isSubmitting}
                className="text-xs"
              >
                {electionForm.formState.isSubmitting ? "Menyimpan…" : "Simpan Pemilu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: FORM JABATAN */}
      <Dialog open={positionModalOpen} onOpenChange={setPositionModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingPosition ? "Edit Data Jabatan" : "Tambah Jabatan Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Jabatan yang diperebutkan dalam pemilu <strong>{selectedElection?.nama}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={positionForm.handleSubmit(onPositionSubmit)}
            className="space-y-3.5 py-1"
          >
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label htmlFor="nomor-jabatan" className="text-xs">
                  Urutan
                </Label>
                <Input
                  id="nomor-jabatan"
                  type="number"
                  min={1}
                  className="h-9 text-xs"
                  {...positionForm.register("nomor", { valueAsNumber: true })}
                />
                {positionForm.formState.errors.nomor && (
                  <p className="text-[11px] text-destructive">
                    {positionForm.formState.errors.nomor.message}
                  </p>
                )}
              </div>

              <div className="col-span-3 space-y-1.5">
                <Label htmlFor="nama-jabatan" className="text-xs">
                  Nama Jabatan
                </Label>
                <Input
                  id="nama-jabatan"
                  placeholder="Contoh: Ketua Umum"
                  className="h-9 text-xs"
                  {...positionForm.register("nama")}
                />
                {positionForm.formState.errors.nama && (
                  <p className="text-[11px] text-destructive">
                    {positionForm.formState.errors.nama.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPositionModalOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={positionForm.formState.isSubmitting}
                className="text-xs"
              >
                {positionForm.formState.isSubmitting ? "Menyimpan…" : "Simpan Jabatan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: KONFIRMASI STATUS PEMILU */}
      <Dialog open={!!statusDialog} onOpenChange={(open) => !open && setStatusDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="size-5 text-amber-500" />
              {statusDialog?.targetStatus === "open"
                ? statusDialog.election.status === "closed"
                  ? "Buka Kembali Pemilihan?"
                  : "Buka Pemilihan?"
                : statusDialog?.targetStatus === "draft"
                ? "Kembalikan ke Status Draft?"
                : "Tutup Pemilihan?"}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {statusDialog?.targetStatus === "open" ? (
                statusDialog.election.status === "closed" ? (
                  <>
                    Membuka kembali pemilu <strong>&quot;{statusDialog.election.nama}&quot;</strong> akan
                    mengaktifkan kembali sesi pemungutan suara. Pemilih terdaftar yang belum memilih akan dapat memberikan suara di bilik.
                  </>
                ) : (
                  <>
                    Membuka pemilu <strong>&quot;{statusDialog.election.nama}&quot;</strong> akan
                    mengunci struktur jabatan dan daftar kandidat. Pemilih akan dapat mulai memberikan suara di bilik.
                  </>
                )
              ) : statusDialog?.targetStatus === "draft" ? (
                <>
                  Mengembalikan pemilu <strong>&quot;{statusDialog?.election.nama}&quot;</strong> ke status Draft
                  akan menonaktifkan pemungutan suara di bilik sementara dan membuka kembali akses pengeditan jabatan serta kandidat.
                </>
              ) : (
                <>
                  Menutup pemilu <strong>&quot;{statusDialog?.election.nama}&quot;</strong> akan
                  mengakhiri sesi pemungutan suara. Hasil rekapitulasi akan ditandai sebagai final. Anda tetap dapat mengedit status atau membukanya kembali nanti jika diperlukan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusDialog(null)}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={confirmStatusChange}
              variant={
                statusDialog?.targetStatus === "open"
                  ? "default"
                  : statusDialog?.targetStatus === "closed"
                  ? "destructive"
                  : "secondary"
              }
              className={`text-xs ${
                statusDialog?.targetStatus === "open"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : ""
              }`}
            >
              {statusDialog?.targetStatus === "open"
                ? statusDialog.election.status === "closed"
                  ? "Ya, Buka Kembali"
                  : "Ya, Buka Pemilu"
                : statusDialog?.targetStatus === "draft"
                ? "Ya, Jadikan Draft"
                : "Ya, Tutup Pemilu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
