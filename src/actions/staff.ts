"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { boothSchema, staffSchema, type BoothItem, type StaffItem } from "@/lib/validations/staff";

async function assertAdmin() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Silakan masuk kembali.");
  const { data: admin } = await db.from("admins").select("id, email").eq("id", user.id).single();
  if (!admin) throw new Error("Akses ditolak.");
  return { db, admin };
}

export async function getStaffAndBooths(electionId?: string) {
  const { db } = await assertAdmin();

  // Get elections list
  const { data: elections } = await db
    .from("elections")
    .select("id, nama, status")
    .order("created_at", { ascending: false });

  const activeElectionId =
    electionId ??
    elections?.find((e) => e.status === "open")?.id ??
    elections?.[0]?.id;

  if (!activeElectionId) {
    return { elections: [], booths: [], staff: [], electionId: "" };
  }

  // Get booths for election
  const { data: boothsRaw } = await db
    .from("booths")
    .select("id, election_id, nama, status, created_at")
    .eq("election_id", activeElectionId)
    .order("nama", { ascending: true });

  // Get all staff
  const { data: staffRaw } = await db
    .from("staff")
    .select("id, nama, booth_id, created_at")
    .order("nama", { ascending: true });

  const boothMap = new Map((boothsRaw ?? []).map((b) => [b.id, b]));
  const staffByBooth = new Map((staffRaw ?? []).filter((s) => s.booth_id).map((s) => [s.booth_id!, s.nama]));

  const booths: BoothItem[] = (boothsRaw ?? []).map((b) => ({
    ...b,
    status: b.status as "kosong" | "terpakai" | "nonaktif",
    staff_name: staffByBooth.get(b.id) ?? null,
  }));

  const staff: StaffItem[] = (staffRaw ?? []).map((s) => {
    const booth = s.booth_id ? boothMap.get(s.booth_id) : null;
    return {
      ...s,
      booth_name: booth ? booth.nama : null,
      booth_status: (booth ? booth.status : null) as "kosong" | "terpakai" | "nonaktif" | null,
    };
  });

  return {
    elections: elections ?? [],
    booths,
    staff,
    electionId: activeElectionId,
  };
}

export async function mutateStaff(action: "create" | "edit" | "delete", input: unknown) {
  try {
    const { db, admin } = await assertAdmin();

    if (action === "delete") {
      const { id } = z.object({ id: z.string().uuid() }).parse(input);
      const { data: existing } = await db.from("staff").select("nama").eq("id", id).single();
      const { error } = await db.from("staff").delete().eq("id", id);
      if (error) throw new Error(error.message);

      await db.from("audit_logs").insert({
        aksi: "hapus_petugas",
        aktor: admin.email,
        detail: { staff_id: id, nama: existing?.nama },
      });

      revalidatePath("/admin/petugas");
      return { ok: true, message: "Petugas berhasil dihapus." };
    }

    const parsed = staffSchema.parse(input);

    if (action === "create") {
      const { error } = await db.from("staff").insert({
        nama: parsed.nama,
        booth_id: parsed.booth_id || null,
      });
      if (error) throw new Error(error.message);

      await db.from("audit_logs").insert({
        aksi: "tambah_petugas",
        aktor: admin.email,
        detail: { nama: parsed.nama, booth_id: parsed.booth_id },
      });

      revalidatePath("/admin/petugas");
      return { ok: true, message: "Petugas berhasil ditambahkan." };
    }

    if (action === "edit") {
      if (!parsed.id) throw new Error("ID petugas diperlukan.");
      const { error } = await db
        .from("staff")
        .update({
          nama: parsed.nama,
          booth_id: parsed.booth_id || null,
        })
        .eq("id", parsed.id);
      if (error) throw new Error(error.message);

      await db.from("audit_logs").insert({
        aksi: "edit_petugas",
        aktor: admin.email,
        detail: { staff_id: parsed.id, nama: parsed.nama, booth_id: parsed.booth_id },
      });

      revalidatePath("/admin/petugas");
      return { ok: true, message: "Data petugas diperbarui." };
    }

    return { ok: false, message: "Aksi tidak dikenali." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Gagal memproses data petugas." };
  }
}

export async function mutateBooth(action: "create" | "edit" | "delete", input: unknown) {
  try {
    const { db, admin } = await assertAdmin();

    if (action === "delete") {
      const { id } = z.object({ id: z.string().uuid() }).parse(input);
      const { data: existing } = await db.from("booths").select("nama, election_id").eq("id", id).single();
      const { error } = await db.from("booths").delete().eq("id", id);
      if (error) throw new Error(error.message);

      await db.from("audit_logs").insert({
        aksi: "hapus_bilik",
        aktor: admin.email,
        detail: { booth_id: id, nama: existing?.nama, election_id: existing?.election_id },
      });

      try {
        const channel = createAdminClient().channel("realtime:booth-status");
        await channel.send({ type: "broadcast", event: "booth-status-change", payload: { booth_id: id, status: "deleted" } });
        createAdminClient().removeChannel(channel);
      } catch {}

      revalidatePath("/admin/petugas");
      revalidatePath("/admin");
      return { ok: true, message: "Bilik berhasil dihapus." };
    }

    const parsed = boothSchema.parse(input);

    if (action === "create") {
      const { error } = await db.from("booths").insert({
        election_id: parsed.election_id,
        nama: parsed.nama,
        status: parsed.status,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Nama bilik sudah digunakan pada pemilu ini.");
        throw new Error(error.message);
      }

      await db.from("audit_logs").insert({
        aksi: "tambah_bilik",
        aktor: admin.email,
        detail: { nama: parsed.nama, election_id: parsed.election_id, status: parsed.status },
      });

      try {
        const channel = createAdminClient().channel("realtime:booth-status");
        await channel.send({ type: "broadcast", event: "booth-status-change", payload: { status: parsed.status } });
        createAdminClient().removeChannel(channel);
      } catch {}

      revalidatePath("/admin/petugas");
      revalidatePath("/admin");
      return { ok: true, message: "Bilik berhasil ditambahkan." };
    }

    if (action === "edit") {
      if (!parsed.id) throw new Error("ID bilik diperlukan.");
      const { error } = await db
        .from("booths")
        .update({
          nama: parsed.nama,
          status: parsed.status,
        })
        .eq("id", parsed.id);
      if (error) {
        if (error.code === "23505") throw new Error("Nama bilik sudah digunakan pada pemilu ini.");
        throw new Error(error.message);
      }

      await db.from("audit_logs").insert({
        aksi: "edit_bilik",
        aktor: admin.email,
        detail: { booth_id: parsed.id, nama: parsed.nama, status: parsed.status },
      });

      try {
        const channel = createAdminClient().channel("realtime:booth-status");
        await channel.send({ type: "broadcast", event: "booth-status-change", payload: { booth_id: parsed.id, status: parsed.status } });
        createAdminClient().removeChannel(channel);
      } catch {}

      revalidatePath("/admin/petugas");
      revalidatePath("/admin");
      return { ok: true, message: "Data bilik diperbarui." };
    }

    return { ok: false, message: "Aksi tidak dikenali." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Gagal memproses data bilik." };
  }
}

