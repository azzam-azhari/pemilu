"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(1024),
});

async function logFailedLogin(email: string, reason: string) {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwardedFor && /^[0-9a-f:.]+$/i.test(forwardedFor) ? forwardedFor : null;
    await createAdminClient().from("audit_logs").insert({ aksi: "login_admin_gagal", aktor: "anonim", detail: { email, reason }, ip });
  } catch {
    // Audit failures must not disclose auth internals or alter the login response.
  }
}

export async function signIn(formData: FormData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect("/login?error=invalid");

  const credentials = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error || !data.user) {
    await logFailedLogin(credentials.email, "kredensial_tidak_valid");
    redirect("/login?error=invalid");
  }

  const { data: admin } = await createAdminClient()
    .from("admins")
    .select("id, role")
    .eq("id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    await logFailedLogin(credentials.email, "bukan_admin");
    redirect("/login?error=unauthorized");
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
