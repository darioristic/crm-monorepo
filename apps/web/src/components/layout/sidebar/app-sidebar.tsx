"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useIsTablet } from "@/hooks/use-mobile";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/layout/sidebar/nav-main";
import { NavUser } from "@/components/layout/sidebar/nav-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import Logo from "@/components/layout/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const isTablet = useIsTablet();
  const [mounted, setMounted] = useState(false);

  // Wait for client-side hydration before applying responsive changes
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isMobile) setOpenMobile(false);
  }, [pathname, isMobile, setOpenMobile, mounted]);

  useEffect(() => {
    if (!mounted) return;
    setOpen(!isTablet);
  }, [isTablet, setOpen, mounted]);

  // Use consistent default value during SSR to avoid hydration mismatch
  const dropdownSide = mounted && isMobile ? "bottom" : "right";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="hover:text-foreground h-10 group-data-[collapsible=icon]:px-0! hover:bg-[var(--primary)]/5">
                  <Logo />
                  <span className="font-semibold">CRM Dashboard</span>
                  <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="mt-4 w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={dropdownSide}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel>Environments</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-md border bg-green-100">
                    <div className="size-2 rounded-full bg-green-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Production</span>
                    <span className="text-xs text-green-700">Active</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-md border bg-yellow-100">
                    <div className="size-2 rounded-full bg-yellow-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Staging</span>
                    <span className="text-muted-foreground text-xs">
                      Testing
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-md border bg-blue-100">
                    <div className="size-2 rounded-full bg-blue-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Development</span>
                    <span className="text-muted-foreground text-xs">Local</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <NavMain />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
