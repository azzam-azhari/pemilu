import { getWebSettings } from "@/actions/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = {
  title: "Pengaturan Web — Admin",
  description: "Pengaturan identitas penyelenggara, tema, format kode unik, dan visibilitas live.",
};

export default async function AdminPengaturanPage() {
  const settings = await getWebSettings();

  return (
    <main className="w-full min-w-0 flex-1 space-y-4 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Konfigurasi Sistem
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pengaturan Web & Tampilan
          </h1>
        </div>
      </div>

      <SettingsForm initialSettings={settings} />
    </main>
  );
}
