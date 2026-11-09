import { Menu } from "lucide-react";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase.from("admins").select("nama, email").eq("id", user.id).maybeSingle();
  if (!admin) redirect("/login?error=unauthorized");

  return (
    <div className="min-h-screen lg:flex">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-header items-center justify-between border-b border-border-soft bg-background/75 px-6 backdrop-blur-[20px] sm:px-10">
          <div className="flex items-center gap-3"><Menu className="size-5 lg:hidden" /><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Area Admin</p></div>
          <div className="flex items-center gap-4"><p className="hidden text-right text-xs text-muted-foreground sm:block"><span className="block font-medium text-foreground">{admin.nama}</span>{admin.email}</p><ThemeToggle /></div>
        </header>
        {children}
      </div>
    </div>
  );
}
