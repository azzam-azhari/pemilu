import Link from "next/link";
import { ArrowRight, Check, ShieldCheck, Vote, Radio, LayoutDashboard } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
  "1 Kode Unik = Maksimal 1 Kali Memilih (Atomik)",
  "Anonimitas Mutlak: Suara disimpan tanpa voter_id",
  "Rekonsiliasi Real-time: Total suara = total pemilih yang hadir",
  "Layar Proyektor Live Preview dengan Supabase Realtime",
  "Audit Log lengkap untuk setiap mutasi dan percobaan akses",
];

export default function HomePage() {
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background px-4 py-4 sm:px-8 sm:py-6">
      <header className="mx-auto flex h-14 w-full max-w-[1440px] shrink-0 items-center justify-between rounded-card border bg-card px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-wide">E-Voting Pemilu</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin">
              <LayoutDashboard className="size-3.5" /> Admin
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto grid min-h-0 w-full max-w-[1440px] flex-1 items-center gap-6 py-4 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sistem Pemilihan Umum Digital
          </p>
          <h1 className="font-heading text-3xl font-semibold leading-[1.15] tracking-[-0.02em] sm:text-4xl xl:text-5xl">
            Satu suara rahasia, dijaga dengan integritas.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Platform e-voting berkeamanan tinggi dengan kode sekali pakai, transaksi suara atomik anti-ganda, rekonsiliasi suara otomatis, dan pemantauan live real-time.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/bilik">
                <Vote className="size-4" /> Masuk Bilik Suara <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/live">
                <Radio className="size-4" /> Pantau Hasil Live
              </Link>
            </Button>
          </div>
        </div>

        <Card className="hidden max-w-xl justify-self-end gap-4 py-5 shadow-sm md:flex">
          <CardHeader>
            <Badge variant="outline" className="mb-1 w-fit gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em]">
              <span className="size-2 animate-pulse rounded-full bg-emerald-600" /> Sistem Siap & Terverifikasi
            </Badge>
            <CardTitle className="text-xl">Keamanan & Integritas Terjamin</CardTitle>
            <CardDescription>
              Fondasi teknologi dirancang untuk pemilu yang bebas, rahasia, jujur, dan adil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 text-sm" role="list">
              {FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span className="text-xs text-muted-foreground">Fase 8: QA & Hardening</span>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">Buka Dashboard Admin</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}
