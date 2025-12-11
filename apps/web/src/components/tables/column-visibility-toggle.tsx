"use client";

import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ColumnVisibilityToggleProps<TData> = {
  table: Table<TData>;
  onVisibilityChange?: (columnId: string, isVisible: boolean) => void;
};

export function ColumnVisibilityToggle<TData>({
  table,
  onVisibilityChange,
}: ColumnVisibilityToggleProps<TData>) {
  const columns = table.getAllColumns().filter((column) => column.getCanHide());

  if (columns.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Settings2 className="size-4" />
          <span className="hidden sm:inline">Columns</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const columnName =
            typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;

          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => {
                column.toggleVisibility(!!value);
                onVisibilityChange?.(column.id, !!value);
              }}
            >
              {columnName}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
