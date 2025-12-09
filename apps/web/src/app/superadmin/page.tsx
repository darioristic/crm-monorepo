"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";
import { formatDate } from "@/lib/utils";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "deleted";
  createdAt: string;
  updatedAt: string;
}

export default function SuperadminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch("/api/superadmin/tenants");
      if (response.ok) {
        const data = await response.json();
        setTenants(data.data || []);
      }
    } catch (error) {
      logger.error("Error fetching tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Tenants Overview</h2>
        <Button asChild>
          <Link href="/superadmin/provision">Provision New Tenant</Link>
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tenants.map((tenant) => (
          <Card key={tenant.id} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <div
                        className="h-8 w-8 rounded-full"
                        style={{
                          background:
                            "radial-gradient(circle at 30% 30%, #ff80b5, #9089fc 55%, #7dd3fc)",
                        }}
                      />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    {editingId === tenant.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="max-w-[220px]"
                        />
                        <Button
                          size="sm"
                          disabled={saving || !nameInput.trim()}
                          onClick={async () => {
                            setSaving(true);
                            try {
                              const res = await fetch(`/api/superadmin/tenants/${tenant.id}`, {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                  name: nameInput.trim(),
                                }),
                              });
                              if (res.ok) {
                                const updated = await res.json();
                                setTenants((prev) =>
                                  prev.map((t) =>
                                    t.id === tenant.id
                                      ? {
                                          ...t,
                                          name: updated.data.name,
                                          updatedAt: updated.data.updatedAt,
                                        }
                                      : t
                                  )
                                );
                                setEditingId(null);
                                setNameInput("");
                              }
                            } catch {}
                            setSaving(false);
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingId(null);
                            setNameInput("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm sm:text-base">{tenant.name}</h3>
                        <Badge
                          variant={
                            tenant.status === "active"
                              ? "default"
                              : tenant.status === "suspended"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {tenant.status}
                        </Badge>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                    <div className="text-xs">Created: {formatDate(new Date(tenant.createdAt))}</div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditingId(tenant.id);
                        setNameInput(tenant.name);
                      }}
                    >
                      Edit Name
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        window.location.href = `/superadmin/tenants/${tenant.id}`;
                      }}
                    >
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => {
                        setDeletingId(tenant.id);
                        setDeleteOpen(true);
                      }}
                    >
                      Delete Tenant
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeletingId(null);
        }}
        title="Delete Tenant"
        description="Are you sure you want to delete this tenant? This action cannot be undone."
        onConfirm={async () => {
          if (!deletingId) return;
          setIsDeleting(true);
          try {
            const res = await fetch(`/api/superadmin/tenants/${deletingId}`, {
              method: "DELETE",
            });
            if (res.ok) {
              await fetchTenants();
              setDeleteOpen(false);
              setDeletingId(null);
            }
          } catch {}
          setIsDeleting(false);
        }}
        isLoading={isDeleting}
      />
    </div>
  );
}
