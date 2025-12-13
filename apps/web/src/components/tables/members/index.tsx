"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useState } from "react";
import { InviteTeamMembersModal } from "@/components/modals/invite-team-members-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompanyParams } from "@/hooks/use-company-params";
import { useUserQuery } from "@/hooks/use-user";
import { type CompanyMember, getCompanyMembers, getCurrentCompany } from "@/lib/companies";
import { cn } from "@/lib/utils";
import { columns } from "./columns";

type TeamMember = CompanyMember & {
  id: string;
  companyId: string;
};

export function DataTable() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [isOpen, onOpenChange] = useState(false);
  const { data: user } = useUserQuery();
  const { setParams } = useCompanyParams();

  // Get current company first
  const { data: company } = useQuery({
    queryKey: ["company", "current"],
    queryFn: async () => {
      const result = await getCurrentCompany();
      if (!result.success || !result.data) {
        throw new Error("No company selected");
      }
      return result.data;
    },
  });

  // Get members
  const { data: membersData } = useQuery({
    queryKey: ["company", "members", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const result = await getCompanyMembers(company.id);
      if (!result.success || !result.data) {
        return [];
      }
      // Map to TeamMember format
      return result.data.map((member) => ({
        ...member,
        id: member.id,
        companyId: company.id,
      })) as TeamMember[];
    },
    enabled: !!company?.id,
  });

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: membersData ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    state: {
      columnFilters,
    },
    meta: {
      currentUser: membersData?.find((member) => member.id === user?.id),
      totalOwners: membersData?.filter((member) => member.role === "owner").length,
    },
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search members..."
          value={(table.getColumn("user")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("user")?.setFilterValue(event.target.value)}
          className="max-w-sm"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => setParams({ createCompany: true })}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Company
          </Button>
          <Button onClick={() => onOpenChange(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Invite Member
          </Button>
          <InviteTeamMembersModal onOpenChange={onOpenChange} isOpen={isOpen} />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
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
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
