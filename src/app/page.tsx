import Link from "next/link";
import { ArrowRight, Check, ShieldCheck, Vote, Radio, LayoutDashboard } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-8 sm:px-10">
      <div className="pointer-events-none absolute -left-24 top-24 size-80 rounded-full bg-secondary-container/60 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-16 bottom-0 size-96 rounded-full bg-panel blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1440px]">
        <header className="flex h-header items-center justify-between rounded-card border border-border-soft bg-white/65 px-6 backdrop-blur-[20px] dark:bg-panel/65">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-wide">E-Voting Pemilu</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutDashboard className="size-3.5" /> Admin
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-136px)] items-center gap-16 py-16 lg:grid-cols-2 lg:gap-24">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sistem Pemilihan Umum Digital
            </p>
            <h1 className="text-4xl font-semibold leading-[1.15] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
              Satu suara rahasia, dijaga dengan integritas.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              Platform e-voting berkeamanan tinggi dengan kode sekali pakai, transaksi suara atomik anti-ganda, rekonsiliasi suara otomatis, dan pemantauan live real-time.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/bilik">
                <Button size="lg" className="gap-2 shadow-sm">
                  <Vote className="size-4" /> Masuk Bilik Suara <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/live">
                <Button variant="secondary" size="lg" className="gap-2">
                  <Radio className="size-4 text-emerald-600 dark:text-emerald-400" /> Pantau Hasil Live
                </Button>
              </Link>
            </div>
          </div>

          <Card className="max-w-xl justify-self-end border border-border-soft bg-card/85 shadow-sm backdrop-blur-[20px]">
            <CardHeader>
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-600 animate-pulse" /> Sistem Siap & Terverifikasi
              </div>
              <CardTitle className="text-2xl">Keamanan & Integritas Terjamin</CardTitle>
              <CardDescription>
                Fondasi teknologi dirancang untuk pemilu yang bebas, rahasia, jujur, dan adil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-sm" role="list">
                {[
                  "1 Kode Unik = Maksimal 1 Kali Memilih (Atomik)",
                  "Anonimitas Mutlak: Suara disimpan tanpa voter_id",
                  "Rekonsiliasi Real-time: Total suara = total pemilih yang hadir",
                  "Layar Proyektor Live Preview dengan Supabase Realtime",
                  "Audit Log lengkap untuk setiap mutasi dan percobaan akses",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <Check className="size-3" />
                    </span>
                    <span className="leading-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-5">
              <span className="text-xs text-muted-foreground">Fase 8: QA & Hardening</span>
              <Link href="/admin">
                <Button variant="outline" size="sm">Buka Dashboard Admin</Button>
              </Link>
            </CardFooter>
          </Card>
        </section>
      </div>
    </main>
  );
}
