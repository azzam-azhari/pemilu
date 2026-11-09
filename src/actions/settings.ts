"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { webSettingsSchema, type WebSettings } from "@/lib/validations/settings";

const defaultSettings: WebSettings = {
  nama_penyelenggara: "Panitia Pemilihan Umum",
  logo_url: null,
  tema: "system",
  format_kode_prefix: "PEMILU-",
  format_kode_length: 6,
  tampilkan_hasil_live: true,
};

export async function getWebSettings(): Promise<WebSettings> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("get_web_settings");
    if (error || !data) return defaultSettings;
    return webSettingsSchema.parse(data);
  } catch {
    return defaultSettings;
  }
}

export async function saveWebSettings(input: unknown, logoFormData?: FormData) {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) throw new Error("Silakan masuk kembali.");
    const { data: admin } = await db.from("admins").select("id").eq("id", user.id).single();
    if (!admin) throw new Error("Akses ditolak.");

    const parsed = webSettingsSchema.parse(input);
    let logoUrl = parsed.logo_url;

    const file = logoFormData?.get("logo");
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran logo maksimal 5 MB.");
      if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type)) {
        throw new Error("Logo harus berupa file PNG, JPEG, WebP, atau SVG.");
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const storage = createAdminClient().storage.from("candidate-photos");
      const path = "logo-" + crypto.randomUUID();
      const { error: uploadError } = await storage.upload(path, bytes, { contentType: file.type });
      if (uploadError) throw new Error("Gagal mengunggah logo.");
      logoUrl = storage.getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      ...parsed,
      logo_url: logoUrl,
    };

    const { data, error } = await db.rpc("save_web_settings", { p_settings: payload });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.reason ?? "Gagal menyimpan pengaturan.");

    // Broadcast settings update to realtime channel
    try {
      const channel = createAdminClient().channel("realtime:settings-status");
      await channel.send({
        type: "broadcast",
        event: "settings-change",
        payload: payload,
      });
      createAdminClient().removeChannel(channel);
    } catch {}

    revalidatePath("/admin/pengaturan");
    revalidatePath("/admin");
    revalidatePath("/live");

    return { ok: true, message: "Pengaturan berhasil disimpan.", settings: payload };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Gagal menyimpan pengaturan." };
  }
}

