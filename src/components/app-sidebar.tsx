"use client"

import * as React from "react"
import Link from "next/link"
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Monitor,
  Radio,
  Settings2,
  ShieldCheck,
  UserRoundCheck,
  Users,
  Vote,
} from "lucide-react"

import { NavMain, type NavMainItem } from "@/components/nav-main"
import { NavProjects, type NavProjectItem } from "@/components/nav-projects"
import { NavSecondary, type NavSecondaryItem } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navMainData: NavMainItem[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Kelola Pemilu",
    url: "/admin/pemilu",
    icon: Vote,
  },
  {
    title: "Kandidat",
    url: "/admin/kandidat",
    icon: UserRoundCheck,
  },
  {
    title: "Data DPT",
    url: "/admin/data",
    icon: Users,
  },
  {
    title: "Kelola Petugas",
    url: "/admin/petugas",
    icon: ShieldCheck,
  },
  {
    title: "Hasil Voting",
    url: "/admin/hasil",
    icon: BarChart3,
  },
  // {
  //   title: "Audit Log & Ekspor",
  //   url: "/admin/audit",
  //   icon: ClipboardList,
  // },
  // {
  //   title: "Pengaturan Web",
  //   url: "/admin/pengaturan",
  //   icon: Settings2,
  // },
]

const quickLinksData: NavProjectItem[] = [
  {
    name: "Bilik Suara",
    url: "/bilik",
    icon: Monitor,
    external: true,
  },
  {
    name: "Hasil Live Count",
    url: "/live",
    icon: Radio,
    external: true,
  },
  {
    name: "Portal Pemilih",
    url: "/",
    icon: Vote,
    external: true,
  },
]

const secondaryData: NavSecondaryItem[] = [
  {
    title: "Audit & Keamanan",
    url: "/admin/audit",
    icon: ClipboardList,
  },
  {
    title: "Pengaturan Sistem",
    url: "/admin/pengaturan",
    icon: Settings2,
  },
]

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  admin?: {
    nama?: string | null
    email?: string | null
  } | null
}

export function AppSidebar({ admin, ...props }: AppSidebarProps) {
  const user = {
    name: admin?.nama || "Admin Pemilu",
    email: admin?.email || "admin@pemilu.local",
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                  <Vote className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold tracking-wide">
                    E-Voting Pemilu
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Area Administrator
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainData} />
        <NavProjects projects={quickLinksData} />
        <NavSecondary items={secondaryData} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
