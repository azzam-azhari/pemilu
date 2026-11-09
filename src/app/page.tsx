import { ArrowRight, Check } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-8 sm:px-10">
      <div className="pointer-events-none absolute -left-24 top-24 size-80 rounded-full bg-secondary-container/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 size-96 rounded-full bg-panel blur-3xl" />
      <div className="relative mx-auto max-w-[1440px]">
        <header className="flex h-header items-center justify-between rounded-card border border-border-soft bg-white/65 px-6 backdrop-blur-[20px] dark:bg-panel/65">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Pemilu</span>
          <ThemeToggle />
        </header>

        <section className="grid min-h-[calc(100vh-136px)] items-center gap-16 py-20 lg:grid-cols-2 lg:gap-24">
          <div className="max-w-2xl">
            <p className="mb-6 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Fase 0 · Fondasi</p>
            <h1 className="text-5xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-6xl">Satu suara, dijaga dengan tenang.</h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-muted-foreground">
              Demo dasar visual untuk platform pemilihan ketua yang aman, transparan, dan siap dikembangkan.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button>
                Mulai menyiapkan pemilu <ArrowRight className="size-4" />
              </Button>
              <Button variant="secondary">Lihat dokumentasi</Button>
            </div>
          </div>

          <Card className="max-w-xl justify-self-end">
            <CardHeader>
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-600" /> Sistem siap
              </div>
              <CardTitle>Komponen konsisten, dari awal.</CardTitle>
              <CardDescription>Mode tema, permukaan kaca, dan skala ruang diterapkan sebagai fondasi antarmuka.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 text-sm">
                {["Tombol berbentuk pil", "Kartu radius 24px", "Tema terang dan gelap"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="grid size-6 place-items-center rounded-full bg-panel"><Check className="size-3.5" /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button variant="outline">Komponen UI</Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </main>
  );
}
