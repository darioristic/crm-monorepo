"use client";

import {
  Calculator,
  CommandIcon,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Plus,
  Receipt,
  SearchIcon,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { navItems } from "@/components/layout/sidebar/nav-main";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";

// Quick actions for creating new items
const quickActions = [
  {
    id: "create-invoice",
    label: "Create Invoice",
    icon: Plus,
    href: "/dashboard/sales/invoices/new",
    keywords: ["new invoice", "add invoice"],
  },
  {
    id: "create-quote",
    label: "Create Quote",
    icon: Plus,
    href: "/dashboard/sales/quotes/new",
    keywords: ["new quote", "add proposal"],
  },
  {
    id: "create-order",
    label: "Create Order",
    icon: Plus,
    href: "/dashboard/sales/orders/new",
    keywords: ["new order", "add order"],
  },
  {
    id: "create-customer",
    label: "Create Customer",
    icon: Plus,
    href: "/dashboard/customers?action=create",
    keywords: ["new customer", "add customer"],
  },
];

// Shortcuts for common pages
const shortcuts = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    shortcut: "⌘D",
  },
  {
    id: "invoices",
    label: "Invoices",
    icon: Receipt,
    href: "/dashboard/sales/invoices",
  },
  {
    id: "quotes",
    label: "Quotes",
    icon: FileText,
    href: "/dashboard/sales/quotes",
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: Users,
    href: "/dashboard/accounts",
  },
  {
    id: "vault",
    label: "Vault",
    icon: FolderOpen,
    href: "/dashboard/vault",
  },
  {
    id: "leads",
    label: "Leads",
    icon: TrendingUp,
    href: "/dashboard/crm/leads",
  },
  {
    id: "deals",
    label: "Deals",
    icon: Calculator,
    href: "/dashboard/crm/deals",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
    shortcut: "⌘,",
  },
];

export default function Search() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <div className="lg:flex-1">
      <div className="relative hidden max-w-sm flex-1 lg:block">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          id="global-search"
          name="global-search"
          className="h-9 w-full cursor-pointer rounded-md border pr-4 pl-10 text-sm shadow-xs"
          placeholder="Search..."
          type="search"
          onFocus={() => setOpen(true)}
        />
        <div className="absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded-sm bg-zinc-200 p-1 font-mono text-xs font-medium sm:flex dark:bg-neutral-700">
          <CommandIcon className="size-3" />
          <span>k</span>
        </div>
      </div>
      <div className="block lg:hidden">
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)} suppressHydrationWarning>
          <SearchIcon />
        </Button>
      </div>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command Palette"
        description="Search commands and navigate to pages"
      >
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Quick Actions */}
          <CommandGroup heading="Quick Actions">
            {quickActions.map((action) => (
              <CommandItem
                key={action.id}
                value={`${action.label} ${action.keywords?.join(" ") || ""}`}
                onSelect={() => runCommand(action.href)}
              >
                <action.icon className="size-4" />
                <span>{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {/* Shortcuts */}
          <CommandGroup heading="Shortcuts">
            {shortcuts.map((item) => (
              <CommandItem key={item.id} value={item.label} onSelect={() => runCommand(item.href)}>
                <item.icon className="size-4" />
                <span>{item.label}</span>
                {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {/* Navigation from sidebar */}
          {navItems.map((route) => (
            <React.Fragment key={route.title}>
              <CommandGroup heading={route.title}>
                {route.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.title}
                    onSelect={() => runCommand(item.href)}
                  >
                    {item.icon && <item.icon className="size-4" />}
                    <span>{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
