"use client";

import type { Lead } from "@crm/types";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { leadsApi } from "@/lib/api";
import { LeadFormSheet } from "./lead-form-sheet";

type Props = {
  data: Lead[];
  isLoading?: boolean;
  error?: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSortChange?: (key: string, order: "asc" | "desc") => void;
};

const statusColors: Record<Lead["status"], string> = {
  new: "bg-blue-500",
  contacted: "bg-yellow-500",
  qualified: "bg-green-500",
  lost: "bg-red-500",
  converted: "bg-purple-500",
};

const sourceLabels: Record<Lead["source"], string> = {
  website: "Website",
  referral: "Referral",
  social: "Social Media",
  advertisement: "Advertisement",
  cold_call: "Cold Call",
  event: "Event",
  other: "Other",
};

export function LeadsDataTable({
  data,
  isLoading,
  error,
  page,
  totalPages,
  onPageChange,
  onRefresh,
  onSortChange,
}: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editId, setEditId] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    const nextOrder = sortKey === key ? (sortOrder === "asc" ? "desc" : "asc") : "desc";
    setSortKey(key);
    setSortOrder(nextOrder);
    onSortChange?.(key, nextOrder);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    await leadsApi.delete(id);
    onRefresh();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Error loading leads: {error}</p>
        <Button variant="outline" className="mt-4" onClick={onRefresh}>
          Try Again
        </Button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">No leads found</p>
        <p className="text-sm mt-2">Create your first lead to get started</p>
      </div>
    );
  }

  const editingLead = editId ? data.find((l) => l.id === editId) : undefined;

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("name")}>
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("email")}>
                  Contact
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("company")}>
                  Company
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("status")}>
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Source</TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("value")}>
                  Value
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Checkbox
                    checked={!!selected[lead.id]}
                    onCheckedChange={(v) => setSelected({ ...selected, [lead.id]: !!v })}
                  />
                </TableCell>
                <TableCell className="font-medium">{lead.name}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>{lead.email}</div>
                    {lead.phone && <div className="text-muted-foreground">{lead.phone}</div>}
                  </div>
                </TableCell>
                <TableCell>{lead.company || "-"}</TableCell>
                <TableCell>
                  <Badge className={`${statusColors[lead.status]} text-white capitalize`}>
                    {lead.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {sourceLabels[lead.source] || lead.source}
                </TableCell>
                <TableCell>{lead.value ? `$${lead.value.toLocaleString()}` : "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditId(lead.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(lead.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <LeadFormSheet
        open={!!editId}
        onOpenChange={(open) => !open && setEditId(null)}
        lead={editingLead}
        onSaved={onRefresh}
      />
    </div>
  );
}
