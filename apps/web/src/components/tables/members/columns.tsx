"use client";

import type { ColumnDef, FilterFn, Row } from "@tanstack/react-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { CompanyMember } from "@/lib/companies";
import { MemberActions } from "./member-actions";

type TeamMember = CompanyMember & {
  id: string;
  companyId: string;
};

const userFilterFn: FilterFn<TeamMember> = (
  row: Row<TeamMember>,
  _: string,
  filterValue: string
) => {
  const memberName = `${row.original.firstName} ${row.original.lastName}`.toLowerCase();
  return memberName?.includes(filterValue.toLowerCase()) ?? false;
};

export const columns: ColumnDef<TeamMember>[] = [
  {
    id: "user",
    accessorKey: "user.full_name",
    filterFn: userFilterFn,
    header: "Member",
    cell: ({ row }) => {
      const fullName = `${row.original.firstName} ${row.original.lastName}`;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={row.original.avatarUrl ?? ""} alt={fullName} width={36} height={36} />
            <AvatarFallback>
              {fullName.charAt(0)?.toUpperCase()}
              {fullName.split(" ")[1]?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{fullName}</span>
            <span className="text-xs text-muted-foreground">{row.original.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    id: "role",
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.original.role;
      return (
        <Badge variant={role === "owner" ? "default" : "secondary"} className="capitalize">
          {role}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row, table }) => {
      return <MemberActions member={row.original} table={table} />;
    },
    meta: {
      className: "text-right",
    },
  },
];
