import { ArrowRight, Monitor } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BoothMonitor } from "@/components/admin/booth-monitor";
import { createClient } from "@/lib/supabase/server";
import type { BoothItem } from "@/lib/validations/staff";

const electionStatus = {
  draft: { label: "Draft", dot: "bg-amber-500" },
  open: { label: "Dibuka", dot: "bg-emerald-600" },
  closed: { label: "Ditutup", dot: "bg-outline" },
} as const;

function percentage(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: election } = await supabase
    .from("elections")
    .select("id, nama, status")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const electionId = election?.id;
  const [
    voters,
    voted,
    boothsCount,
    occupiedBooths,
    auditLogs,
    boothData,
    staffData,
  ] = await Promise.all([
    electionId
      ? supabase
          .from("voters")
          .select("id", { count: "exact", head: true })
          .eq("election_id", electionId)
      : Promise.resolve({ count: 0 }),
    electionId
      ? supabase
          .from("voters")
          .select("id", { count: "exact", head: true })
          .eq("election_id", electionId)
          .eq("has_voted", true)
      : Promise.resolve({ count: 0 }),
    electionId
      ? supabase
          .from("booths")
          .select("id", { count: "exact", head: true })
          .eq("election_id", electionId)
      : Promise.resolve({ count: 0 }),
    electionId
      ? supabase
          .from("booths")
          .select("id", { count: "exact", head: true })
          .eq("election_id", electionId)
          .eq("status", "terpakai")
      : Promise.resolve({ count: 0 }),
    supabase
      .from("audit_logs")
      .select("id, aksi, aktor, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    electionId
      ? supabase
          .from("booths")
          .select("id, election_id, nama, status, created_at")
          .eq("election_id", electionId)
          .order("nama", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase.from("staff").select("id, nama, booth_id"),
  ]);

  const totalVoters = voters.count ?? 0;
  const totalVoted = voted.count ?? 0;
  const totalBooths = boothsCount.count ?? 0;
  const usedBooths = occupiedBooths.count ?? 0;
  const status = election
    ? electionStatus[election.status as keyof typeof electionStatus]
    : null;

  const staffByBooth = new Map(
    (staffData.data ?? [])
      .filter((s) => s.booth_id)
      .map((s) => [s.booth_id!, s.nama])
  );
  const initialBooths: BoothItem[] = (boothData.data ?? []).map((b) => ({
    ...b,
    status: b.status as "kosong" | "terpakai" | "nonaktif",
    staff_name: staffByBooth.get(b.id) ?? null,
  }));

  const stats = [
    {
      label: "Total DPT",
      value: totalVoters.toLocaleString("id-ID"),
      description: "Pemilih terdaftar",
    },
    {
      label: "Sudah Memilih",
      value: totalVoted.toLocaleString("id-ID"),
      description: `${percentage(totalVoted, totalVoters)}% partisipasi`,
    },
    {
      label: "Belum Memilih",
      value: (totalVoters - totalVoted).toLocaleString("id-ID"),
      description: "Hak pilih tersedia",
    },
    {
      label: "Bilik Terpakai",
      value: `${usedBooths}/${totalBooths}`,
      description: "Kapasitas saat ini",
    },
  ];

  return (
    <main className="w-full min-w-0 flex-1 space-y-4 p-4 md:p-6">
      {/* Header Halaman Padat */}
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-border-soft pb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Dashboard Overview
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`size-2 rounded-full ${status?.dot ?? "bg-outline"}`} />
              <span>{status?.label ?? "Belum ada pemilu aktif"}</span>
            </div>
          </div>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {election?.nama ?? "Belum ada pemilu aktif"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link href="/admin/hasil">
              <span>Hasil Voting</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 gap-1.5 text-xs">
            <Link href="/admin/pemilu">
              <span>Status Pemilu</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* KPI Stats Cards (High Density) */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-3.5 border-border-soft">
            <CardHeader className="p-0 pb-1">
              <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {stat.label}
              </CardDescription>
              <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 text-xs text-muted-foreground">
              {stat.description}
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Main Grid: Aktivitas & Bilik Suara */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="flex flex-col justify-between border-border-soft p-0">
          <CardHeader className="p-4 pb-2 border-b border-border-soft/60">
            <CardTitle className="text-base font-semibold">Aktivitas Terbaru</CardTitle>
            <CardDescription className="text-xs">
              Riwayat sistem administratif yang paling baru dicatat.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {auditLogs.data?.length ? (
              <ul className="divide-y divide-border-soft">
                {auditLogs.data.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-xs"
                  >
                    <span className="flex items-center gap-2 font-medium truncate">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="truncate">{item.aksi.replaceAll("_", " ")}</span>
                    </span>
                    <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Belum ada aktivitas yang tercatat.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between border-border-soft p-0">
          <CardHeader className="p-4 pb-2 border-b border-border-soft/60">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold">Status Bilik Real-time</CardTitle>
              <span className="grid size-7 place-items-center rounded-md bg-panel text-muted-foreground">
                <Monitor className="size-3.5" />
              </span>
            </div>
            <CardDescription className="text-xs">
              Pemantauan langsung ketersediaan dan aktivitas bilik suara.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <BoothMonitor initialBooths={initialBooths} electionId={electionId} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
