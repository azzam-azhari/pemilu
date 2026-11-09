"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Palette, Save, Shield, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveWebSettings } from "@/actions/settings";
import type { WebSettings } from "@/lib/validations/settings";

interface SettingsFormProps {
  initialSettings: WebSettings;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<WebSettings>(initialSettings);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialSettings.logo_url ?? null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const generateSampleCode = (prefix: string, length: number) => {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let sample = "";
    for (let i = 0; i < length; i++) {
      sample += chars[(i * 7 + 3) % chars.length];
    }
    return prefix + sample;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      if (logoFile) {
        formData.set("logo", logoFile);
      }

      const res = await saveWebSettings(settings, formData);
      if (res.ok) {
        setMessage({ text: res.message });
        if (res.settings) {
          setSettings(res.settings);
        }
        router.refresh();
      } else {
        setMessage({ text: res.message, error: true });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Alert status message */}
      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            message.error
              ? "border-error/30 bg-error/10 text-error"
              : "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Identitas Penyelenggara */}
        <Card className="rounded-[24px] border border-border-soft p-6 sm:p-8">
          <CardHeader className="p-0 pb-6">
            <span className="mb-3 grid size-10 place-items-center rounded-full bg-panel">
              <Shield className="size-4 text-muted-foreground" />
            </span>
            <CardTitle>Identitas Penyelenggara</CardTitle>
            <CardDescription className="text-xs">
              Nama dan logo yang ditampilkan pada surat suara bilik dan layar proyektor.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-5">
            <label className="grid gap-1.5 text-xs font-medium">
              Nama Penyelenggara / Organisasi
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={settings.nama_penyelenggara}
                onChange={(e) =>
                  setSettings({ ...settings, nama_penyelenggara: e.target.value })
                }
                placeholder="Contoh: KPU Mahasiswa 2026"
                className="rounded-input border border-border-soft bg-background p-3 text-sm"
              />
            </label>

            <div>
              <p className="text-xs font-medium mb-2">Logo Penyelenggara (Opsional)</p>
              <div className="flex items-center gap-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl border border-border-soft bg-panel">
                  {logoPreview ? (
                    <Image
                      src={logoPreview}
                      alt="Logo preview"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                      Logo
                    </div>
                  )}
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border-soft bg-panel px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary-container transition-colors">
                  <Upload className="size-3.5" /> Unggah Logo Baru
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoChange}
                    className="sr-only"
                  />
                </label>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Format didukung: PNG, JPEG, WebP, SVG. Maksimal 5 MB.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Visibilitas & Tema */}
        <Card className="rounded-[24px] border border-border-soft p-6 sm:p-8">
          <CardHeader className="p-0 pb-6">
            <span className="mb-3 grid size-10 place-items-center rounded-full bg-panel">
              <Palette className="size-4 text-muted-foreground" />
            </span>
            <CardTitle>Tampilan & Visibilitas Publik</CardTitle>
            <CardDescription className="text-xs">
              Kontrol penayangan hasil live ke publik dan preferensi visual.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            {/* Toggle Tampilkan Hasil Live */}
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-border-soft bg-panel/40 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium text-sm">
                  {settings.tampilkan_hasil_live ? (
                    <Eye className="size-4 text-emerald-600" />
                  ) : (
                    <EyeOff className="size-4 text-amber-500" />
                  )}
                  <span>Tampilkan Hasil Live ke Publik (/live)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bila dinonaktifkan, halaman proyektor publik (`/live`) menampilkan layar penahan informasi sehingga hasil suara tidak terlihat publik hingga diaktifkan kembali.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.tampilkan_hasil_live}
                  onChange={(e) =>
                    setSettings({ ...settings, tampilkan_hasil_live: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="h-6 w-11 rounded-full bg-border-soft peer-checked:bg-emerald-600 peer-focus:outline-none transition-colors after:absolute after:top-0.5 after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
              </label>
            </div>

            {/* Tema default */}
            <label className="grid gap-1.5 text-xs font-medium">
              Tema Antarmuka Bawaan
              <select
                value={settings.tema}
                onChange={(e) =>
                  setSettings({ ...settings, tema: e.target.value as typeof settings.tema })
                }
                className="rounded-input border border-border-soft bg-background p-3 text-sm"
              >
                <option value="system">Mengikuti Sistem Pengguna</option>
                <option value="light">Terang (Light Mode)</option>
                <option value="dark">Gelap (Dark Mode)</option>
              </select>
            </label>
          </CardContent>
        </Card>

        {/* Format Kode Unik Pemilih */}
        <Card className="rounded-[24px] border border-border-soft p-6 sm:p-8 lg:col-span-2">
          <CardHeader className="p-0 pb-6">
            <span className="mb-3 grid size-10 place-items-center rounded-full bg-panel">
              <KeyRound className="size-4 text-muted-foreground" />
            </span>
            <CardTitle>Format Kode Unik Sekali Pakai</CardTitle>
            <CardDescription className="text-xs">
              Standar pembuatan kode unik otomatis saat penambahan atau impor pemilih DPT baru.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-medium">
                Awalan Kode (Prefix)
                <input
                  type="text"
                  required
                  value={settings.format_kode_prefix}
                  onChange={(e) =>
                    setSettings({ ...settings, format_kode_prefix: e.target.value.toUpperCase() })
                  }
                  placeholder="Contoh: PEMILU-"
                  className="rounded-input border border-border-soft bg-background p-3 text-sm font-mono"
                />
                <span className="text-[11px] text-muted-foreground">
                  Gunakan huruf kapital, angka, atau tanda pisah (-).
                </span>
              </label>

              <label className="grid gap-1.5 text-xs font-medium">
                Panjang Karakter Acak
                <input
                  type="number"
                  required
                  min={4}
                  max={32}
                  value={settings.format_kode_length}
                  onChange={(e) =>
                    setSettings({ ...settings, format_kode_length: Number(e.target.value) })
                  }
                  className="rounded-input border border-border-soft bg-background p-3 text-sm font-mono"
                />
                <span className="text-[11px] text-muted-foreground">
                  Antara 4 sampai 32 karakter acak (bebas dari huruf ambigu 0/O dan 1/I).
                </span>
              </label>
            </div>

            {/* Preview Sampel Kode */}
            <div className="rounded-2xl border border-border-soft bg-panel/30 p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Pratinjau Kode Unik:
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="rounded-xl border border-border-soft bg-background px-4 py-2 font-mono text-lg font-bold tracking-widest text-primary">
                  {generateSampleCode(settings.format_kode_prefix, settings.format_kode_length)}
                </span>
                <span className="text-xs text-muted-foreground">
                  (Panjang total: {settings.format_kode_prefix.length + settings.format_kode_length} karakter)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="gap-2">
          <Save className="size-4" />
          {isPending ? "Menyimpan Pengaturan…" : "Simpan Semua Pengaturan"}
        </Button>
      </div>
    </form>
  );
}

