"use client";

import * as React from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BellIcon,
  Building2Icon,
  CalendarIcon,
  ChartBarDecreasingIcon,
  ChevronRight,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderArchive,
  FolderDotIcon,
  LayoutDashboardIcon,
  MilestoneIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  ShoppingCartIcon,
  SquareKanbanIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
  BarChart3Icon,
} from "lucide-react";
import Link from "next/link";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavGroup = {
  title: string;
  items: NavItem;
};

type NavItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
  items?: NavItem;
}[];

export const navItems: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboardIcon,
      },
      {
        title: "Calendar",
        href: "/dashboard/calendar",
        icon: CalendarIcon,
      },
      {
        title: "Vault",
        href: "/dashboard/vault",
        icon: FolderArchive,
      },
      {
        title: "Notifications",
        href: "/dashboard/notifications",
        icon: BellIcon,
      },
    ],
  },
  {
    title: "CRM",
    items: [
      {
        title: "Users",
        href: "/dashboard/users",
        icon: UsersIcon,
      },
      {
        title: "Companies",
        href: "/dashboard/companies",
        icon: Building2Icon,
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        title: "Overview",
        href: "/dashboard/sales",
        icon: ChartBarDecreasingIcon,
      },
      {
        title: "Quotes",
        href: "/dashboard/sales/quotes",
        icon: FileTextIcon,
      },
      {
        title: "Invoices",
        href: "/dashboard/sales/invoices",
        icon: ReceiptIcon,
      },
      {
        title: "Orders",
        href: "/dashboard/sales/orders",
        icon: ShoppingCartIcon,
      },
      {
        title: "Delivery Notes",
        href: "/dashboard/sales/delivery-notes",
        icon: TruckIcon,
      },
      {
        title: "Products",
        href: "/dashboard/products",
        icon: PackageIcon,
      },
      {
        title: "Payments",
        href: "/dashboard/payments",
        icon: CreditCardIcon,
      },
    ],
  },
  {
    title: "Projects",
    items: [
      {
        title: "All Projects",
        href: "/dashboard/projects",
        icon: FolderDotIcon,
      },
      {
        title: "Tasks",
        href: "/dashboard/projects/tasks",
        icon: ClipboardCheckIcon,
      },
      {
        title: "Task Board",
        href: "/dashboard/tasks-app",
        icon: ClipboardCheckIcon,
      },
      {
        title: "Kanban",
        href: "/dashboard/kanban",
        icon: SquareKanbanIcon,
      },
      {
        title: "Milestones",
        href: "/dashboard/projects/milestones",
        icon: MilestoneIcon,
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        title: "Overview",
        href: "/dashboard/reports",
        icon: BarChart3Icon,
      },
      {
        title: "Sales Reports",
        href: "/dashboard/reports/sales",
        icon: ShoppingCartIcon,
      },
      {
        title: "Project Reports",
        href: "/dashboard/reports/projects",
        icon: FolderDotIcon,
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        title: "Profile",
        href: "/dashboard/profile",
        icon: UserIcon,
      },
      {
        title: "Settings",
        href: "/dashboard/settings",
        icon: SettingsIcon,
      },
    ],
  },
];

export function NavMain() {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Use consistent default values during SSR to avoid hydration mismatch
  const dropdownSide = mounted && isMobile ? "bottom" : "right";
  const dropdownAlign = mounted && isMobile ? "end" : "start";

  return (
    <>
      {navItems.map((nav) => (
        <SidebarGroup key={nav.title}>
          <SidebarGroupLabel>{nav.title}</SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {nav.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {Array.isArray(item.items) && item.items.length > 0 ? (
                    <>
                      <div className="hidden group-data-[collapsible=icon]:block">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuButton tooltip={item.title}>
                              {item.icon && <item.icon className="h-4 w-4" />}
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            side={dropdownSide}
                            align={dropdownAlign}
                            className="min-w-48 rounded-lg"
                          >
                            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                            {item.items?.map((subItem) => (
                              <DropdownMenuItem
                                className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10!"
                                asChild
                                key={subItem.title}
                              >
                                <Link href={subItem.href}>{subItem.title}</Link>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <Collapsible
                        className="group/collapsible block group-data-[collapsible=icon]:hidden"
                        defaultOpen={
                          !!item.items.find((s) => s.href === pathname)
                        }
                      >
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                            tooltip={item.title}
                          >
                            {item.icon && <item.icon className="h-4 w-4" />}
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item?.items?.map((subItem, key) => (
                              <SidebarMenuSubItem key={key}>
                                <SidebarMenuSubButton
                                  asChild
                                  className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10 w-full"
                                  isActive={pathname === subItem.href}
                                >
                                  <Link href={subItem.href}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    </>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10 w-full"
                      isActive={pathname === item.href}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        {item.icon && <item.icon className="h-4 w-4" />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
