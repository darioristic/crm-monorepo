"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { columns } from "./columns";
import { DataTableHeader } from "./table-header";

type TeamInvite = {
  id: string;
  email: string;
  role: "owner" | "member" | "admin";
  companyId: string;
};

export function DataTable() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const { data } = useQuery({
    queryKey: ["company", "invites"],
    queryFn: async (): Promise<TeamInvite[]> => {
      const { invitesApi } = await import("@/lib/api");
      const response = await invitesApi.getAll();
      if (response.success && response.data) {
        return response.data.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          companyId: "", // Will be filled from current company context
        }));
      }
      return [];
    },
  });

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: data ?? [],
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="w-full space-y-4">
      <DataTableHeader table={table} />

      <div className="rounded-md border">
        <Table>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "py-4",
                        (cell.column.columnDef.meta as { className?: string } | undefined)
                          ?.className
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-[360px] text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <h3 className="font-medium text-sm">No Pending Invitations</h3>
                    <p className="text-sm text-muted-foreground">
                      Use the button above to invite a team member.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
