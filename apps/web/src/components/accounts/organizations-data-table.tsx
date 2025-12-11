"use client";

import type { CustomerOrganization } from "@crm/types";
import { ArrowUpDown, Pencil, Star, StarOff, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { organizationsApi } from "@/lib/api";

type Props = {
  data: CustomerOrganization[];
  isLoading?: boolean;
  error?: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSortChange?: (key: string, order: "asc" | "desc") => void;
};

export function OrganizationsDataTable({
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
  const router = useRouter();
  const pathname = usePathname();

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    const nextOrder = sortKey === key ? (sortOrder === "asc" ? "desc" : "asc") : "desc";
    setSortKey(key);
    setSortOrder(nextOrder);
    onSortChange?.(key, nextOrder);
  };

  const toggleFavorite = async (id: string, favorite: boolean) => {
    await organizationsApi.favorite(id, favorite);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await organizationsApi.delete(id);
    onRefresh();
  };

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
                <Button variant="ghost" onClick={() => handleSort("pib")}>
                  Identifiers
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort("email")}>
                  Contact
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Checkbox
                    checked={!!selected[c.id]}
                    onCheckedChange={(v) => setSelected({ ...selected, [c.id]: !!v })}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={c.logoUrl || ""} alt={c.name} />
                      <AvatarFallback>{c.name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <span>{c.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {[c.pib, c.companyNumber].filter(Boolean).join(" · ") || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    {c.email && <span className="text-xs">{c.email}</span>}
                    {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleFavorite(c.id, !c.isFavorite)}
                    >
                      {c.isFavorite ? (
                        <Star className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <StarOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`${pathname}?type=edit&organizationId=${c.id}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} / {totalPages || 1}
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
    </div>
  );
}
