import { ArrowRight, Monitor } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { data: election } = await supabase.from("elections").select("id, nama, status").order("created_at", { ascending: false }).limit(1).maybeSingle();

  const electionId = election?.id;
  const [voters, voted, boothsCount, occupiedBooths, auditLogs, boothData, staffData] = await Promise.all([
    electionId ? supabase.from("voters").select("id", { count: "exact", head: true }).eq("election_id", electionId) : Promise.resolve({ count: 0 }),
    electionId ? supabase.from("voters").select("id", { count: "exact", head: true }).eq("election_id", electionId).eq("has_voted", true) : Promise.resolve({ count: 0 }),
    electionId ? supabase.from("booths").select("id", { count: "exact", head: true }).eq("election_id", electionId) : Promise.resolve({ count: 0 }),
    electionId ? supabase.from("booths").select("id", { count: "exact", head: true }).eq("election_id", electionId).eq("status", "terpakai") : Promise.resolve({ count: 0 }),
    supabase.from("audit_logs").select("id, aksi, aktor, created_at").order("created_at", { ascending: false }).limit(5),
    electionId ? supabase.from("booths").select("id, election_id, nama, status, created_at").eq("election_id", electionId).order("nama", { ascending: true }) : Promise.resolve({ data: [] }),
    supabase.from("staff").select("id, nama, booth_id"),
  ]);

  const totalVoters = voters.count ?? 0;
  const totalVoted = voted.count ?? 0;
  const totalBooths = boothsCount.count ?? 0;
  const usedBooths = occupiedBooths.count ?? 0;
  const status = election ? electionStatus[election.status as keyof typeof electionStatus] : null;

  const staffByBooth = new Map((staffData.data ?? []).filter((s) => s.booth_id).map((s) => [s.booth_id!, s.nama]));
  const initialBooths: BoothItem[] = (boothData.data ?? []).map((b) => ({
    ...b,
    status: b.status as "kosong" | "terpakai" | "nonaktif",
    staff_name: staffByBooth.get(b.id) ?? null,
  }));

  const stats = [
    { label: "Total DPT", value: totalVoters.toLocaleString("id-ID"), description: "Pemilih terdaftar" },
    { label: "Sudah memilih", value: totalVoted.toLocaleString("id-ID"), description: `${percentage(totalVoted, totalVoters)}% partisipasi` },
    { label: "Belum memilih", value: (totalVoters - totalVoted).toLocaleString("id-ID"), description: "Hak pilih tersedia" },
    { label: "Bilik terpakai", value: `${usedBooths}/${totalBooths}`, description: "Status saat ini" },
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-12 sm:px-10">
      <section className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Dashboard</p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">{election?.nama ?? "Belum ada pemilu aktif"}</h1>
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`size-2 rounded-full ${status?.dot ?? "bg-outline"}`} /> {status?.label ?? "Siapkan pemilu pertama untuk melihat ringkasan."}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary"><Link href="/admin/hasil">Lihat hasil voting <ArrowRight className="size-4" /></Link></Button>
          <Button asChild><Link href="/admin/pemilu">Kelola status pemilu <ArrowRight className="size-4" /></Link></Button>
        </div>
      </section>

      <section className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader><CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">{stat.label}</CardDescription><CardTitle className="text-4xl font-medium tracking-[-0.02em]">{stat.value}</CardTitle></CardHeader>
            <CardContent className="pt-5 text-sm text-muted-foreground">{stat.description}</CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-12 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle>Aktivitas terbaru</CardTitle><CardDescription>Riwayat sistem yang paling baru dicatat.</CardDescription></CardHeader>
          <CardContent>
            {auditLogs.data?.length ? <ul className="divide-y divide-border-soft">{auditLogs.data.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 py-4 text-sm"><span className="flex items-center gap-3"><span className="size-2 rounded-full bg-outline" />{item.aksi.replaceAll("_", " ")}</span><span className="text-right text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span></li>)}</ul> : <p className="text-sm leading-relaxed text-muted-foreground">Belum ada aktivitas yang tercatat.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><span className="mb-3 grid size-10 place-items-center rounded-full bg-panel"><Monitor className="size-4" /></span><CardTitle>Status bilik real-time</CardTitle><CardDescription>Pemantauan langsung ketersediaan dan aktivitas bilik suara.</CardDescription></CardHeader>
          <CardContent>
            <BoothMonitor initialBooths={initialBooths} electionId={electionId} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
