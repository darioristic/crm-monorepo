"use client";

import { usePathname } from "next/navigation";
import type * as React from "react";
import { useEffect, useState } from "react";
import { TenantSwitcher } from "@/components/layout/header/tenant-switcher";
import { NavMain } from "@/components/layout/sidebar/nav-main";
import { NavUser } from "@/components/layout/sidebar/nav-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsTablet } from "@/hooks/use-mobile";

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

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TenantSwitcher />
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
