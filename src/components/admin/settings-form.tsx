"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Palette, Save, Shield, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
          setLogoPreview(res.settings.logo_url ?? null);
        }
        router.refresh();
      } else {
        setMessage({ text: res.message, error: true });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full min-w-0 space-y-4">
      {/* Alert status message */}
      {message && (
        <Alert variant={message.error ? "destructive" : "default"} className="py-2.5 text-xs">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Identitas Penyelenggara */}
        <Card className="rounded-card border border-border-soft p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-panel text-muted-foreground">
                  <Shield className="size-3.5" />
                </span>
                <CardTitle className="text-base font-semibold">Identitas Penyelenggara</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Nama dan logo yang ditampilkan pada surat suara bilik dan layar proyektor.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 p-0 pt-1">
              <div className="grid gap-1.5">
                <Label htmlFor="nama_penyelenggara" className="text-xs font-medium">
                  Nama Penyelenggara / Organisasi
                </Label>
                <Input
                  id="nama_penyelenggara"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={settings.nama_penyelenggara}
                  onChange={(e) =>
                    setSettings({ ...settings, nama_penyelenggara: e.target.value })
                  }
                  placeholder="Contoh: KPU Mahasiswa 2026"
                  className="h-9 text-xs rounded-input bg-background"
                />
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-medium">Logo Penyelenggara (Opsional)</Label>
                <div className="flex items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border-soft bg-panel">
                    {logoPreview ? (
                      <Image
                        src={logoPreview}
                        alt="Logo preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">
                        Logo
                      </div>
                    )}
                  </div>
                  <Label
                    htmlFor="logo-file"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border-soft bg-panel px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary-container"
                  >
                    <Upload className="size-3" /> Unggah Logo Baru
                    <input
                      id="logo-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoChange}
                      className="sr-only"
                    />
                  </Label>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Format didukung: PNG, JPEG, WebP, SVG. Maksimal 5 MB.
                </p>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* Visibilitas & Tema */}
        <Card className="rounded-card border border-border-soft p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-panel text-muted-foreground">
                  <Palette className="size-3.5" />
                </span>
                <CardTitle className="text-base font-semibold">Tampilan & Visibilitas Publik</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Kontrol penayangan hasil live ke publik dan preferensi visual antarmuka.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3.5 p-0 pt-1">
              {/* Toggle Tampilkan Hasil Live */}
              <div className="flex items-start justify-between gap-3 rounded-md border border-border-soft bg-panel/30 p-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {settings.tampilkan_hasil_live ? (
                      <Eye className="size-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="size-3.5 text-amber-500" />
                    )}
                    <span>Tampilkan Hasil Live ke Publik (/live)</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Bila dinonaktifkan, halaman proyektor publik (`/live`) menampilkan layar siaga penahan informasi sehingga hasil suara tidak terlihat publik.
                  </p>
                </div>
                <Switch
                  checked={settings.tampilkan_hasil_live}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, tampilkan_hasil_live: checked })
                  }
                />
              </div>

              {/* Tema default */}
              <div className="grid gap-1.5">
                <Label htmlFor="theme-select" className="text-xs font-medium">
                  Tema Antarmuka Bawaan
                </Label>
                <Select
                  value={settings.tema}
                  onValueChange={(v) => setSettings({ ...settings, tema: v as typeof settings.tema })}
                >
                  <SelectTrigger id="theme-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">Mengikuti Sistem Pengguna</SelectItem>
                    <SelectItem value="light">Terang (Light Mode)</SelectItem>
                    <SelectItem value="dark">Gelap (Dark Mode)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* Format Kode Unik Pemilih */}
        <Card className="rounded-card border border-border-soft p-4 sm:p-5 lg:col-span-2">
          <CardHeader className="p-0 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-panel text-muted-foreground">
                <KeyRound className="size-3.5" />
              </span>
              <CardTitle className="text-base font-semibold">Format Kode Unik Sekali Pakai</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Standar pembuatan kode unik otomatis saat penambahan atau impor pemilih DPT baru.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 p-0 pt-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="format_prefix" className="text-xs font-medium">
                  Awalan Kode (Prefix)
                </Label>
                <Input
                  id="format_prefix"
                  type="text"
                  required
                  value={settings.format_kode_prefix}
                  onChange={(e) =>
                    setSettings({ ...settings, format_kode_prefix: e.target.value.toUpperCase() })
                  }
                  placeholder="Contoh: PEMILU-"
                  className="h-9 rounded-input bg-background font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground">
                  Gunakan huruf kapital, angka, atau tanda pisah (-).
                </span>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="format_length" className="text-xs font-medium">
                  Panjang Karakter Acak
                </Label>
                <Input
                  id="format_length"
                  type="number"
                  required
                  min={4}
                  max={32}
                  value={settings.format_kode_length}
                  onChange={(e) =>
                    setSettings({ ...settings, format_kode_length: Number(e.target.value) })
                  }
                  className="h-9 rounded-input bg-background font-mono text-xs"
                />
                <span className="text-[10px] text-muted-foreground">
                  Antara 4 sampai 32 karakter acak (bebas dari huruf ambigu 0/O dan 1/I).
                </span>
              </div>
            </div>

            {/* Preview Sampel Kode */}
            <div className="rounded-md border border-border-soft bg-panel/30 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pratinjau Format Kode Unik DPT:
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-md border border-border-soft bg-background px-3 py-1 font-mono text-base font-bold tracking-widest text-primary">
                    {generateSampleCode(settings.format_kode_prefix, settings.format_kode_length)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({settings.format_kode_prefix.length + settings.format_kode_length} karakter)
                  </span>
                </div>
              </div>
              <Button type="submit" disabled={isPending} size="sm" className="h-8 gap-1.5 text-xs font-medium">
                <Save className="size-3.5" />
                <span>{isPending ? "Menyimpan…" : "Simpan Pengaturan"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
