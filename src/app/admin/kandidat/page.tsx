import Link from "next/link";
import { ArrowRight, Layers, Vote } from "lucide-react";

import { CandidateManager } from "@/components/admin/candidate-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Kelola Kandidat — Admin Pemilu",
  description: "Daftar kandidat, foto, dan visi misi pemilihan.",
};

export default async function AdminKandidatPage({
  searchParams,
}: {
  searchParams: Promise<{ jabatan?: string }>;
}) {
  const db = await createClient();
  const q = await searchParams;

  const { data: positions, error } = await db
    .from("positions")
    .select("*, elections(nama, status)")
    .order("urutan");

  if (error) throw new Error("Tidak dapat memuat jabatan.");

  const selected = positions?.find((p) => p.id === q.jabatan) ?? positions?.[0];
  const candidates = selected
    ? await db
        .from("candidates")
        .select("*")
        .eq("position_id", selected.id)
        .order("no_urut")
    : null;

  if (candidates?.error) throw new Error("Tidak dapat memuat data kandidat.");

  return (
    <main className="w-full min-w-0 flex-1 space-y-4 p-4 md:p-6">
      {/* Header Halaman Padat */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Manajemen Data
            </p>
            {selected && (
              <Badge
                variant={selected.elections.status === "open" ? "default" : "outline"}
                className="text-[10px] uppercase font-medium h-4 px-1.5"
              >
                Pemilu: {selected.elections.status}
              </Badge>
            )}
          </div>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kandidat Pemilu
          </h1>
        </div>

        {selected && (
          <div className="text-xs text-muted-foreground sm:text-right">
            <span>Pemilu: </span>
            <strong className="text-foreground">{selected.elections.nama}</strong>
          </div>
        )}
      </div>

      {/* Navigasi Pilihan Jabatan (Pills Padat) */}
      {positions && positions.length > 0 ? (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
          <span className="flex items-center gap-1 pr-1 text-xs font-medium text-muted-foreground shrink-0">
            <Layers className="size-3.5" /> Jabatan:
          </span>
          {positions.map((p) => {
            const isSelected = selected?.id === p.id;
            return (
              <Button
                key={p.id}
                asChild
                size="sm"
                variant={isSelected ? "default" : "outline"}
                className={`h-8 rounded-full text-xs shrink-0 px-3.5 transition-all ${
                  isSelected
                    ? "font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link href={`?jabatan=${p.id}`}>
                  <span>{p.nama_jabatan}</span>
                  <span
                    className={`ml-1.5 text-[10px] ${
                      isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    ({p.elections.nama})
                  </span>
                </Link>
              </Button>
            );
          })}
        </div>
      ) : null}

      {/* Konten Utama Kandidat */}
      {selected ? (
        <CandidateManager
          key={selected.id}
          positionId={selected.id}
          positionName={selected.nama_jabatan}
          rows={candidates?.data ?? []}
          locked={selected.elections.status !== "draft"}
        />
      ) : (
        <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
          <div className="grid size-12 place-items-center rounded-full bg-muted/60 text-muted-foreground">
            <Vote className="size-6" />
          </div>
          <h2 className="mt-3 text-base font-semibold">Belum Ada Jabatan Terdaftar</h2>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            Anda perlu membuat pemilu dan menentukan jabatan (seperti Ketua, Wakil Ketua) terlebih dahulu sebelum dapat mengelola kandidat.
          </p>
          <Button asChild size="sm" className="mt-4 gap-1.5 text-xs">
            <Link href="/admin/pemilu">
              <span>Ke Halaman Kelola Pemilu</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </Card>
      )}
    </main>
  );
}
