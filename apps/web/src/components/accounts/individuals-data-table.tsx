"use client";

import type { Contact } from "@crm/types";
import { ArrowUpDown, Pencil, Star, StarOff, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { contactsApi } from "@/lib/api";
import { ContactFormSheet } from "./contact-form-sheet";

type Props = {
  data: Contact[];
  isLoading?: boolean;
  error?: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSortChange?: (key: string, order: "asc" | "desc") => void;
};

export function IndividualsDataTable({
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

  const toggleFavorite = async (id: string, favorite: boolean) => {
    await contactsApi.favorite(id, favorite);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await contactsApi.delete(id);
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
                <Button variant="ghost" onClick={() => handleSort("lastName")}>
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
                <Button variant="ghost" onClick={() => handleSort("jmbg")}>
                  JMBG
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
                <TableCell>{`${c.firstName} ${c.lastName}`.trim()}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    {c.email && <span className="text-xs">{c.email}</span>}
                    {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{c.jmbg || "-"}</TableCell>
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
                    <Button variant="ghost" size="icon" onClick={() => setEditId(c.id)}>
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
      <ContactFormSheet
        open={!!editId}
        onOpenChange={(o) => !o && setEditId(null)}
        contactId={editId || undefined}
        onSaved={() => {
          setEditId(null);
          onRefresh();
        }}
      />
    </div>
  );
}
