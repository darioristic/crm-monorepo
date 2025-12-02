"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  Building2Icon,
  ContrastIcon,
  CreditCardIcon,
  PaletteIcon,
  ShieldIcon,
  UserIcon
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const sidebarNavItems = [
  {
    title: "Workspace",
    href: "/dashboard/settings/workspace",
    icon: Building2Icon
  },
  {
    title: "Company",
    href: "/dashboard/settings/company",
    icon: Building2Icon
  },
  {
    title: "Profile",
    href: "/dashboard/settings",
    icon: UserIcon
  },
  {
    title: "Account",
    href: "/dashboard/settings/account",
    icon: ShieldIcon
  },
  {
    title: "Billing",
    href: "/dashboard/settings/billing",
    icon: CreditCardIcon
  },
  {
    title: "Appearance",
    href: "/dashboard/settings/appearance",
    icon: PaletteIcon
  },
  {
    title: "Notifications",
    href: "/dashboard/settings/notifications",
    icon: BellIcon
  },
  {
    title: "Display",
    href: "/dashboard/settings/display",
    icon: ContrastIcon
  }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <Card className="py-0">
      <CardContent className="p-2">
        <nav className="flex flex-col space-y-0.5 space-x-2 lg:space-x-0">
          {sidebarNavItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              className={cn(
                "hover:bg-muted justify-start",
                pathname === item.href ? "bg-muted hover:bg-muted" : ""
              )}
              asChild>
              <Link href={item.href as any}>
                {item.icon && <item.icon />}
                {item.title}
              </Link>
            </Button>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}
