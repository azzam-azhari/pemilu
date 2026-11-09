import { getWebSettings } from "@/actions/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = {
  title: "Pengaturan Web — Admin",
  description: "Pengaturan identitas penyelenggara, tema, format kode unik, dan visibilitas live.",
};

export default async function AdminPengaturanPage() {
  const settings = await getWebSettings();

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-12 sm:px-10">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Pengaturan Web
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Konfigurasi Sistem & Tampilan
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kelola identitas pemilihan, standar pembuatan kode unik DPT, serta visibilitas hasil live proyektor.
        </p>
      </div>

      <SettingsForm initialSettings={settings} />
    </main>
  );
}

