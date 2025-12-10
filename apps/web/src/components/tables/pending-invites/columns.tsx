"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, FilterFn, Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TeamInvite = {
  id: string;
  email: string;
  role: "owner" | "member" | "admin";
  companyId: string;
};

const emailFilterFn: FilterFn<TeamInvite> = (
  row: Row<TeamInvite>,
  _: string,
  filterValue: string
) => {
  const email = row.original.email?.toLowerCase();
  return email?.includes(filterValue.toLowerCase()) ?? false;
};

export const columns: ColumnDef<TeamInvite>[] = [
  {
    id: "email",
    accessorKey: "email",
    filterFn: emailFilterFn,
    cell: ({ row }) => {
      return (
        <div className="flex items-center space-x-4">
          <Avatar className="rounded-full w-8 h-8">
            <AvatarFallback>
              <span className="text-xs">
                {row.original.email?.slice(0, 1)?.toUpperCase() ?? "P"}
              </span>
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm">Pending Invitation</span>
            <span className="text-sm text-[#606060]">{row.original.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const queryClient = useQueryClient();

      const deleteInvite = useMutation({
        mutationFn: async (inviteId: string) => {
          const { invitesApi } = await import("@/lib/api");
          await invitesApi.delete(inviteId);
          return { success: true };
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["company", "invites"] });
          toast.success("Invitation removed");
        },
        onError: () => {
          toast.error("Failed to remove invitation");
        },
      });

      return (
        <div className="flex justify-end">
          <div className="flex space-x-2 items-center">
            <span className="text-[#606060]">{row.original.role || "member"}</span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => deleteInvite.mutate(row.original.id)}
                >
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      );
    },
    meta: {
      className: "text-right",
    },
  },
];
