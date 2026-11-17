"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { manage, change } from "@/actions/management";
import { managementSchema, type ManagementInput } from "@/lib/validations/management";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type Row = {
  id: string;
  nama?: string;
  nama_jabatan?: string;
  status?: string;
  periode_mulai?: string;
  periode_selesai?: string;
  urutan?: number;
  no_urut?: number;
  info?: string;
  visi_misi?: string;
  foto?: string;
};

function Editor({
  entity,
  parent,
  row,
  close,
}: {
  entity: ManagementInput["entity"];
  parent?: string;
  row?: Row;
  close: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ManagementInput>({
    resolver: zodResolver(managementSchema),
    defaultValues: {
      entity,
      parent,
      id: row?.id,
      nama: row?.nama ?? row?.nama_jabatan ?? "",
      nomor: row?.urutan ?? row?.no_urut ?? 1,
      mulai: row?.periode_mulai?.slice(0, 10) ?? "",
      selesai: row?.periode_selesai?.slice(0, 10) ?? "",
      info: row?.info ?? "",
      visi_misi: row?.visi_misi ?? "",
    },
  });
  const [file, setFile] = useState<File>();

  return (
    <Card className="p-6">
      <h2 className="mb-6 text-xl font-semibold">{row ? "Edit" : "Tambah"} data</h2>
      <form
        className="grid gap-5"
        onSubmit={handleSubmit(async (v) => {
          const fd = new FormData();
          if (file) fd.set("foto", file);
          const result = await manage(v, fd);
          setMessage(result.message);
          if (result.ok) {
            router.refresh();
            close();
          }
        })}
      >
        <div className="grid gap-2">
          <Label htmlFor="nama">Nama</Label>
          <Input id="nama" className="rounded-input bg-panel" {...register("nama")} />
        </div>

        {entity === "elections" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mulai">Mulai (WIB)</Label>
              <Controller
                control={control}
                name="mulai"
                render={({ field, fieldState }) => (
                  <DatePicker id="mulai" value={field.value} onChange={field.onChange} aria-invalid={fieldState.invalid} />
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="selesai">Selesai (WIB)</Label>
              <Controller
                control={control}
                name="selesai"
                render={({ field, fieldState }) => (
                  <DatePicker id="selesai" value={field.value} onChange={field.onChange} aria-invalid={fieldState.invalid} />
                )}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="nomor">Nomor urut</Label>
            <Input
              id="nomor"
              type="number"
              className="rounded-input bg-panel"
              {...register("nomor", { valueAsNumber: true })}
            />
          </div>
        )}

        {entity === "candidates" && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="info">Info singkat</Label>
              <Input id="info" className="rounded-input bg-panel" {...register("info")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="visi_misi">Visi & misi</Label>
              <Textarea id="visi_misi" rows={5} className="rounded-input bg-panel" {...register("visi_misi")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="foto">Foto (maksimal 5 MB)</Label>
              <Input
                id="foto"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="rounded-input bg-panel"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </div>
          </>
        )}

        {(Object.keys(errors).length > 0 || message) && (
          <Alert variant={Object.keys(errors).length > 0 ? "destructive" : "default"}>
            <AlertDescription>
              {Object.values(errors).map((e, i) => (
                <p key={i}>{e.message}</p>
              ))}
              {message}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button disabled={isSubmitting}>{isSubmitting ? "Menyimpan…" : "Simpan"}</Button>
          <Button type="button" variant="outline" onClick={close}>
            Batal
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SortableRow({
  row,
  disabled,
  children,
}: {
  row: Row;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-start gap-3"
    >
      <Button
        variant="outline"
        size="icon"
        disabled={disabled}
        {...attributes}
        {...listeners}
        className="touch-none"
        aria-label={"Urutkan " + row.nama_jabatan}
      >
        ↕
      </Button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Manager({
  entity,
  parent,
  rows,
  locked = false,
}: {
  entity: ManagementInput["entity"];
  parent?: string;
  rows: Row[];
  locked?: boolean;
}) {
  const dndContextId = useId();
  const [editing, setEditing] = useState<Row | null | undefined>();
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const run = (input: Parameters<typeof change>[0]) =>
    start(async () => {
      try {
        const r = await change(input);
        setMessage(r.message);
        router.refresh();
      } catch {
        setMessage("Koneksi gagal. Silakan coba lagi.");
      }
    });

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const variant = status === "open" ? "default" : status === "closed" ? "secondary" : "outline";
    return (
      <Badge variant={variant} className="mt-2 text-xs uppercase">
        {status}
      </Badge>
    );
  };

  const body = (row: Row) => (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-medium">
            {row.urutan ?? row.no_urut ?? ""} {row.nama ?? row.nama_jabatan}
          </h3>
          {row.status && getStatusBadge(row.status)}
          {row.info && <p className="mt-2 text-sm text-muted-foreground">{row.info}</p>}
          {row.visi_misi && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{row.visi_misi}</p>}
          {row.foto && (
            <a href={row.foto} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">
              Lihat foto kandidat
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={locked || pending} onClick={() => setEditing(row)}>
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={locked || pending || (!!row.status && row.status !== "draft")}
            onClick={() => {
              if (confirm("Hapus data ini beserta data turunannya?")) run({ entity, id: row.id });
            }}
          >
            Hapus
          </Button>
          {row.status && row.status !== "closed" && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                const status = row.status === "draft" ? "open" : "closed";
                if (
                  confirm(
                    status === "open"
                      ? "Buka pemilu? Jabatan dan kandidat akan dikunci."
                      : "Tutup pemilu? Status tidak dapat dikembalikan."
                  )
                )
                  run({ entity, id: row.id, status });
              }}
            >
              {row.status === "draft" ? "Buka pemilu" : "Tutup pemilu"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <section className="space-y-6">
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {locked && <p className="text-sm text-muted-foreground">Jabatan dan kandidat dikunci karena pemilu bukan Draft.</p>}
      <Button disabled={locked || pending} onClick={() => setEditing(null)}>
        Tambah {entity === "elections" ? "pemilu" : entity === "positions" ? "jabatan" : "kandidat"}
      </Button>
      {editing !== undefined && (
        <Editor
          key={editing?.id ?? "new"}
          entity={entity}
          parent={parent}
          row={editing ?? undefined}
          close={() => setEditing(undefined)}
        />
      )}
      {entity === "positions" ? (
        <DndContext
          id={dndContextId}
          sensors={sensors}
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) {
              const ids = arrayMove(
                rows.map((r) => r.id),
                rows.findIndex((r) => r.id === active.id),
                rows.findIndex((r) => r.id === over.id)
              );
              run({ entity, id: parent, order: ids });
            }
          }}
        >
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {rows.map((row) => (
                <SortableRow key={row.id} row={row} disabled={locked || pending}>
                  {body(row)}
                </SortableRow>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-4">{rows.map((row) => <div key={row.id}>{body(row)}</div>)}</div>
      )}
      {!rows.length && <p className="text-muted-foreground">Belum ada data.</p>}
    </section>
  );
}
