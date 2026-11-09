import { BarChart3, ClipboardList, LayoutDashboard, LogOut, Settings2, ShieldCheck, Users, UserRoundCheck, Vote } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pemilu", label: "Kelola Pemilu", icon: Vote },
  { href: "/admin/data", label: "Data DPT", icon: Users },
  { href: "/admin/kandidat", label: "Kandidat", icon: UserRoundCheck },
  { href: "/admin/petugas", label: "Kelola Petugas", icon: ShieldCheck },
  { href: "/admin/hasil", label: "Hasil Voting", icon: BarChart3 },
  { href: "/admin/audit", label: "Audit Log & Ekspor", icon: ClipboardList },
  { href: "/admin/pengaturan", label: "Pengaturan Web", icon: Settings2 },
];

export function AdminSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-border-soft bg-white/60 p-6 backdrop-blur-[20px] lg:flex dark:bg-panel/60">
      <Link href="/admin" className="mb-12 flex items-center gap-3 px-2">
        <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground"><Vote className="size-4" /></span>
        <span className="text-sm font-medium uppercase tracking-[0.14em]">Pemilu</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Navigasi admin">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-full px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-panel hover:text-foreground">
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </nav>
      <form action={signOut}>
        <Button type="submit" variant="ghost" className="w-full justify-start"><LogOut className="size-4" /> Keluar</Button>
      </form>
    </aside>
  );
}
