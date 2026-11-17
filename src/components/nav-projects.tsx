"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLink, type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavProjectItem {
  name: string
  url: string
  icon: LucideIcon
  external?: boolean
}

export function NavProjects({
  projects,
}: {
  projects: NavProjectItem[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Akses Cepat</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => {
          const isActive = pathname === item.url

          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                <Link
                  href={item.url}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                >
                  <item.icon className="size-4" />
                  <span>{item.name}</span>
                  {item.external ? (
                    <ExternalLink className="ml-auto size-3 opacity-60" />
                  ) : null}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
