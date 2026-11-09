import { LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { signIn } from "@/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const errors: Record<string, string> = {
  invalid: "Email atau kata sandi tidak valid.",
  unauthorized: "Akun ini tidak memiliki akses sebagai admin.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-10">
      <div className="pointer-events-none absolute -left-32 top-24 size-96 rounded-full bg-secondary-container/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-panel blur-3xl" />
      <div className="absolute right-6 top-6"><ThemeToggle /></div>
      <Card className="relative w-full max-w-md">
        <CardHeader>
          <span className="mb-5 grid size-11 place-items-center rounded-full bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></span>
          <CardTitle>Masuk ke dashboard</CardTitle>
          <CardDescription>Gunakan akun admin yang dibuat oleh penyelenggara pemilu.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && errors[error] ? <p role="alert" className="mb-6 rounded-input bg-error-container px-4 py-3 text-sm text-on-error-container">{errors[error]}</p> : null}
          <form action={signIn} className="space-y-5">
            <label className="grid gap-2 text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required className="h-11 rounded-input border border-border-soft bg-panel px-4 text-sm outline-none transition focus:border-primary" placeholder="admin@organisasi.id" /></label>
            <label className="grid gap-2 text-sm font-medium">Kata sandi<input name="password" type="password" autoComplete="current-password" required className="h-11 rounded-input border border-border-soft bg-panel px-4 text-sm outline-none transition focus:border-primary" /></label>
            <Button type="submit" className="w-full"><LockKeyhole className="size-4" /> Masuk sebagai admin</Button>
          </form>
          <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">Akses hanya untuk penyelenggara. <Link href="/" className="underline underline-offset-4">Kembali ke beranda</Link></p>
        </CardContent>
      </Card>
    </main>
  );
}
