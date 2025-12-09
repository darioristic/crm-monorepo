"use client";

import { ArrowUpDown, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { TenantCompanyForm } from "@/components/companies/tenant-company-form";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TenantCompany } from "@/lib/api";

function UserEditSheet(props: any) {
  const {
    open,
    onOpenChange,
    userToEdit,
    editUserForm,
    setEditUserForm,
    id,
    fetchUsers,
    creating,
    setCreating,
    companies,
  } = props;
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(undefined);
  const [companyMemberRole, setCompanyMemberRole] = useState<"member" | "admin">("member");
  const companyItems: { id: string; label: string }[] = (companies || [])
    .filter((c: any) => (c as any).source !== "customer")
    .map((c: any) => ({ id: String(c.id), label: String(c.name) }));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="mb-6">
          <h2 className="text-xl">{userToEdit ? "Edit User" : "Edit User"}</h2>
        </SheetHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!userToEdit) return;
            setCreating(true);
            try {
              const res = await fetch(`/api/superadmin/tenants/${id}/users/${userToEdit.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editUserForm),
              });
              if (res.ok) {
                if (selectedCompanyId) {
                  try {
                    const mRes = await fetch(`/api/v1/companies/${selectedCompanyId}/members`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userId: userToEdit.id,
                        role: companyMemberRole,
                      }),
                    });
                    if (!mRes.ok) {
                      const err = await mRes.json().catch(() => ({}));
                      alert(err.error?.message || "Failed to add user to company");
                    }
                  } catch (_error) {
                    alert("Failed to add user to company");
                  }
                }
                await fetchUsers();
                onOpenChange(false);
              } else {
                const err = await res.json();
                alert(err.error?.message || "Failed to update user");
              }
            } catch (_error) {
              alert("Failed to update user");
            }
            setCreating(false);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={editUserForm.firstName}
                onChange={(e) =>
                  setEditUserForm({
                    ...editUserForm,
                    firstName: e.target.value,
                  })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={editUserForm.lastName}
                onChange={(e) =>
                  setEditUserForm({
                    ...editUserForm,
                    lastName: e.target.value,
                  })
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={editUserForm.email}
              onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Company</Label>
              <ComboboxDropdown
                placeholder="Select company"
                searchPlaceholder="Search companies..."
                items={companyItems}
                selectedItem={
                  selectedCompanyId
                    ? companyItems.find((i) => i.id === selectedCompanyId)
                    : undefined
                }
                onSelect={(item) => setSelectedCompanyId(item.id)}
              />
            </div>
            <div className="space-y-2">
              <Label>Company Role</Label>
              <Select
                value={companyMemberRole}
                onValueChange={(v) => setCompanyMemberRole(v as "member" | "admin")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">CRM User</SelectItem>
                  <SelectItem value="admin">Admin User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                className="w-full border rounded px-3 py-2"
                value={editUserForm.role}
                onChange={(e) =>
                  setEditUserForm({
                    ...editUserForm,
                    role: e.target.value as "crm_user" | "tenant_admin",
                  })
                }
              >
                <option value="crm_user">CRM User</option>
                <option value="tenant_admin">Tenant Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="w-full border rounded px-3 py-2"
                value={editUserForm.status}
                onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

type Props = { params: Promise<{ id: string }> };

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "deleted";
  createdAt: string;
};

type Company = {
  id: string;
  name: string;
  industry: string;
  city?: string;
  country?: string;
  address: string;
};

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function TenantDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [companies, setCompanies] = useState<TenantCompany[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<"companies" | "tenant-companies" | "users">(
    "companies"
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", address: "" });
  const [userForm, setUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "crm_user" as "crm_user" | "tenant_admin",
  });
  const [userPasswordError, setUserPasswordError] = useState<string | null>(null);
  const [userCompanyError, setUserCompanyError] = useState<string | null>(null);
  const [createUserCompanyId, setCreateUserCompanyId] = useState<string | undefined>(undefined);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Record<string, boolean>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<Record<string, boolean>>({});
  const [deleteCompaniesOpen, setDeleteCompaniesOpen] = useState(false);
  const [deleteUsersOpen, setDeleteUsersOpen] = useState(false);
  const [isBulkDeletingCompanies, setIsBulkDeletingCompanies] = useState(false);
  const [isBulkDeletingUsers, setIsBulkDeletingUsers] = useState(false);
  const [deleteCompanyOpen, setDeleteCompanyOpen] = useState(false);
  const [companyToDeleteId, setCompanyToDeleteId] = useState<string | null>(null);
  const [companyQuery, setCompanyQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createCompanySource, setCreateCompanySource] = useState<"account" | "customer">("account");
  const [createCompanyType, setCreateCompanyType] = useState<"seller" | "customer">("seller");
  const [companySort, setCompanySort] = useState<{
    key: "name" | "industry" | "city";
    order: "asc" | "desc";
  }>({ key: "name", order: "asc" });
  const [userSort, setUserSort] = useState<{
    key: "name" | "email" | "role" | "status";
    order: "asc" | "desc";
  }>({ key: "name", order: "asc" });
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<TenantCompany | null>(null);
  const [editCompanySource, setEditCompanySource] = useState<"account" | "customer">("account");
  const [editCompanyType, setEditCompanyType] = useState<"seller" | "customer">("seller");
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "crm_user" as "crm_user" | "tenant_admin",
    status: "active",
  });
  const [deletingUserIds, setDeletingUserIds] = useState<Record<string, boolean>>({});
  const [pendingUserDelete, setPendingUserDelete] = useState<Record<string, number>>({});
  const [pendingCompanyDelete, setPendingCompanyDelete] = useState<Record<string, number>>({});
  const [pendingBulkUsers, setPendingBulkUsers] = useState<{
    ids: string[];
    timer: number;
  } | null>(null);
  const [pendingBulkCompanies, setPendingBulkCompanies] = useState<{
    ids: string[];
    timer: number;
  } | null>(null);
  const UNDO_MS = 5000;
  useEffect(() => {
    void fetchTenant();
    void fetchCompanies();
    void fetchUsers();
  }, [id]);

  const fetchTenant = async () => {
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}`);
      const data = await res.json();
      setTenant(data.data || null);
      if (data?.data?.name) setNameInput(data.data.name);
    } catch {}
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}/companies`);
      const data = await res.json();
      setCompanies(data.data || []);
    } catch {}
    setLoading(false);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}/users`);
      const data = await res.json();
      const list = (data.data || []) as Array<any>;
      const filtered = list.filter(
        (u) =>
          u && u.status !== "deleted" && u.deleted !== true && u.isDeleted !== true && !u.deletedAt
      );
      setUsers(filtered);
    } catch {}
    setLoading(false);
  };

  const _createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: "", industry: "", address: "" });
        await fetchCompanies();
      } else {
        const err = await res.json();
        alert(err.error?.message || "Failed to create company");
      }
    } catch (_error) {
      alert("Failed to create company");
    }
    setCreating(false);
  };

  const _createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      if (res.ok) {
        setUserForm({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          confirmPassword: "",
          role: "crm_user",
        });
        await fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error?.message || "Failed to create user");
      }
    } catch (_error) {
      alert("Failed to create user");
    }
    setCreating(false);
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    const prevUsers = users;
    const prevSelected = selectedUserIds;
    setDeletingUserIds((prev) => ({ ...prev, [userId]: true }));
    setUsers((curr) => curr.filter((u) => u.id !== userId));
    setSelectedUserIds((prev) => {
      const next = { ...prev } as Record<string, boolean>;
      delete next[userId];
      return next;
    });
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/superadmin/tenants/${id}/users/${userId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setUsers(prevUsers);
          setSelectedUserIds(prevSelected);
          toast.error(err?.error?.message || "Failed to delete user");
        } else {
          toast.success("User deleted");
        }
      } catch (_error) {
        setUsers(prevUsers);
        setSelectedUserIds(prevSelected);
        toast.error("Failed to delete user");
      }
      setDeletingUserIds((prev) => ({ ...prev, [userId]: false }));
      setPendingUserDelete((prev) => {
        const p = { ...prev };
        delete p[userId];
        return p;
      });
    }, UNDO_MS);
    setPendingUserDelete((prev) => ({ ...prev, [userId]: timer }));
    toast("User removed", {
      description: "You can undo within 5 seconds",
      action: {
        label: "Undo",
        onClick: () => {
          const t = pendingUserDelete[userId];
          if (t) {
            clearTimeout(t);
            setPendingUserDelete((prev) => {
              const p = { ...prev };
              delete p[userId];
              return p;
            });
          }
          setUsers(prevUsers);
          setSelectedUserIds(prevSelected);
          setDeletingUserIds((prev) => ({ ...prev, [userId]: false }));
          toast.success("User restored");
        },
      },
    });
  };

  const saveTenantName = async () => {
    setSavingName(true);
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTenant((prev) => (prev ? { ...prev, name: updated.data.name } : prev));
        setEditingName(false);
      }
    } catch {}
    setSavingName(false);
  };

  const handleBulkDeleteCompanies = async () => {
    const ids = Object.keys(selectedCompanyIds).filter((k) => selectedCompanyIds[k]);
    if (ids.length === 0) {
      setDeleteCompaniesOpen(false);
      return;
    }
    setIsBulkDeletingCompanies(true);
    const prevCompanies = companies;
    setCompanies((curr) => curr.filter((c) => !ids.includes(c.id)));
    setSelectedCompanyIds({});
    setDeleteCompaniesOpen(false);
    const timer = window.setTimeout(async () => {
      try {
        for (const companyId of ids) {
          const res = await fetch(`/api/superadmin/tenants/${id}/companies/${companyId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message || "Failed to delete company");
          }
        }
        toast.success("Companies deleted");
      } catch (_error) {
        setCompanies(prevCompanies);
        toast.error("Failed to delete companies");
      }
      setIsBulkDeletingCompanies(false);
      setPendingBulkCompanies(null);
    }, UNDO_MS);
    setPendingBulkCompanies({ ids, timer });
    toast("Companies removed", {
      description: "You can undo within 5 seconds",
      action: {
        label: "Undo",
        onClick: () => {
          const pending = pendingBulkCompanies;
          if (pending?.timer) {
            clearTimeout(pending.timer);
            setPendingBulkCompanies(null);
          }
          setCompanies(prevCompanies);
          setIsBulkDeletingCompanies(false);
          toast.success("Companies restored");
        },
      },
    });
  };

  const handleBulkDeleteUsers = async () => {
    const ids = Object.keys(selectedUserIds).filter((k) => selectedUserIds[k]);
    if (ids.length === 0) {
      setDeleteUsersOpen(false);
      return;
    }
    setIsBulkDeletingUsers(true);
    const prevUsers = users;
    setUsers((curr) => curr.filter((u) => !ids.includes(u.id)));
    setSelectedUserIds({});
    setDeleteUsersOpen(false);
    const timer = window.setTimeout(async () => {
      try {
        for (const userId of ids) {
          const res = await fetch(`/api/superadmin/tenants/${id}/users/${userId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message || "Failed to delete user");
          }
        }
        toast.success("Users deleted");
      } catch (_error) {
        setUsers(prevUsers);
        toast.error("Failed to delete users");
      }
      setIsBulkDeletingUsers(false);
      setPendingBulkUsers(null);
    }, UNDO_MS);
    setPendingBulkUsers({ ids, timer });
    toast("Users removed", {
      description: "You can undo within 5 seconds",
      action: {
        label: "Undo",
        onClick: () => {
          const pending = pendingBulkUsers;
          if (pending?.timer) {
            clearTimeout(pending.timer);
            setPendingBulkUsers(null);
          }
          setUsers(prevUsers);
          setIsBulkDeletingUsers(false);
          toast.success("Users restored");
        },
      },
    });
  };

  const handleDeleteCompany = async () => {
    if (!companyToDeleteId) {
      setDeleteCompanyOpen(false);
      return;
    }
    setIsBulkDeletingCompanies(true);
    const prevCompanies = companies;
    const idToDelete = companyToDeleteId;
    setCompanies((curr) => curr.filter((c) => c.id !== idToDelete));
    setDeleteCompanyOpen(false);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/superadmin/tenants/${id}/companies/${idToDelete}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setCompanies(prevCompanies);
          toast.error(err?.error?.message || "Failed to delete company");
        } else {
          toast.success("Company deleted");
        }
      } catch (_error) {
        setCompanies(prevCompanies);
        toast.error("Failed to delete company");
      }
      setIsBulkDeletingCompanies(false);
      setPendingCompanyDelete((prev) => {
        const p = { ...prev };
        if (idToDelete) delete p[idToDelete];
        return p;
      });
    }, UNDO_MS);
    if (idToDelete) setPendingCompanyDelete((prev) => ({ ...prev, [idToDelete]: timer }));
    setCompanyToDeleteId(null);
    toast("Company removed", {
      description: "You can undo within 5 seconds",
      action: {
        label: "Undo",
        onClick: () => {
          const t = idToDelete ? pendingCompanyDelete[idToDelete] : null;
          if (t) {
            clearTimeout(t);
            setPendingCompanyDelete((prev) => {
              const p = { ...prev };
              if (idToDelete) delete p[idToDelete];
              return p;
            });
          }
          setCompanies(prevCompanies);
          setIsBulkDeletingCompanies(false);
          toast.success("Company restored");
        },
      },
    });
  };

  if (!tenant) {
    return <div>Loading tenant...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="max-w-xs"
              />
              <Button size="sm" disabled={savingName || !nameInput.trim()} onClick={saveTenantName}>
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingName(false);
                  setNameInput(tenant.name);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{tenant.name}</h2>
              <Button variant="ghost" size="icon" onClick={() => setEditingName(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-muted-foreground">Slug: {tenant.slug}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/superadmin")}>
          Back
        </Button>
      </div>

      <div className="border-b">
        <div className="flex gap-4">
          <button
            className={`px-4 py-2 border-b-2 ${
              activeTab === "companies"
                ? "border-primary font-semibold"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setActiveTab("companies")}
          >
            Customer Companies (
            {companies.filter((c) => (c as any).companyType === "customer").length})
          </button>
          <button
            className={`px-4 py-2 border-b-2 ${
              activeTab === "tenant-companies"
                ? "border-primary font-semibold"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setActiveTab("tenant-companies")}
          >
            Tenant Companies ({companies.filter((c) => (c as any).companyType === "seller").length})
          </button>
          <button
            className={`px-4 py-2 border-b-2 ${
              activeTab === "users"
                ? "border-primary font-semibold"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setActiveTab("users")}
          >
            Users ({users.length})
          </button>
        </div>
      </div>

      {activeTab === "companies" && (
        <div className="grid grid-cols-1 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Customer Companies</h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateCompanyType("customer");
                    setCreateCompanyOpen(true);
                  }}
                >
                  Create Company
                </Button>
                <Input
                  placeholder="Search company..."
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  className="h-8 w-48"
                />
                {Object.values(selectedCompanyIds).some(Boolean) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteCompaniesOpen(true)}
                    className="gap-2"
                    disabled={isBulkDeletingCompanies}
                  >
                    {isBulkDeletingCompanies ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" /> Delete
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {loading ? (
              <div>Loading companies...</div>
            ) : companies.length ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        {(() => {
                          const items = companies;
                          const some = items.some((c) => !!selectedCompanyIds[c.id]);
                          const all =
                            items.length > 0 && items.every((c) => !!selectedCompanyIds[c.id]);
                          return (
                            <Checkbox
                              checked={all || (some && "indeterminate")}
                              onCheckedChange={(v) => {
                                const checked = !!v;
                                setSelectedCompanyIds((prev) => {
                                  const next = { ...prev } as Record<string, boolean>;
                                  for (const c of items) {
                                    next[c.id] = checked;
                                  }
                                  return next;
                                });
                              }}
                              aria-label="Select all companies"
                            />
                          );
                        })()}
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="-ml-3"
                          onClick={() =>
                            setCompanySort((prev) => ({
                              key: "name",
                              order: prev.key === "name" && prev.order === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          Company
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="-ml-3"
                          onClick={() =>
                            setCompanySort((prev) => ({
                              key: "industry",
                              order:
                                prev.key === "industry" && prev.order === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          Industry
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="-ml-3"
                          onClick={() =>
                            setCompanySort((prev) => ({
                              key: "city",
                              order: prev.key === "city" && prev.order === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          Location
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies
                      .filter((c) => (c as any).companyType === "customer")
                      .filter((c) => {
                        const q = companyQuery.toLowerCase();
                        return (
                          !q ||
                          c.name.toLowerCase().includes(q) ||
                          c.industry.toLowerCase().includes(q) ||
                          (c.city || "").toLowerCase().includes(q)
                        );
                      })
                      .sort((a, b) => {
                        const dir = companySort.order === "asc" ? 1 : -1;
                        if (companySort.key === "name") {
                          return a.name.localeCompare(b.name) * dir;
                        }
                        if (companySort.key === "industry") {
                          return (a.industry || "").localeCompare(b.industry || "") * dir;
                        }
                        return (a.city || "").localeCompare(b.city || "") * dir;
                      })
                      .map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Checkbox
                              checked={!!selectedCompanyIds[c.id]}
                              onCheckedChange={(v) =>
                                setSelectedCompanyIds((prev) => ({
                                  ...prev,
                                  [c.id]: Boolean(v),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className="h-6 w-6 rounded-full"
                                style={{
                                  background:
                                    "radial-gradient(circle at 30% 30%, #ff80b5, #9089fc 55%, #7dd3fc)",
                                }}
                              />
                              <div className="space-y-0.5">
                                <div className="font-medium text-sm">{c.name}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex flex-col gap-1">
                              <span>{c.industry}</span>
                              <Badge
                                variant={
                                  (c as any).companyType === "seller" ? "default" : "secondary"
                                }
                              >
                                {(c as any).companyType === "seller" ? "Seller" : "Customer"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {c.city} {c.country}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCompanyToEdit(c);
                                  setEditCompanySource(
                                    (c.source as "account" | "customer") || "account"
                                  );
                                  setEditCompanyType(
                                    ((c as any).companyType as "seller" | "customer") || "seller"
                                  );
                                  setEditCompanyOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setCompanyToDeleteId(c.id);
                                  setDeleteCompanyOpen(true);
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No companies</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "tenant-companies" && (
        <div className="grid grid-cols-1 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Tenant Companies</h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateCompanyType("seller");
                    setCreateCompanyOpen(true);
                  }}
                >
                  Create Company
                </Button>
                <Input
                  placeholder="Search company..."
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  className="h-8 w-48"
                />
                {Object.values(selectedCompanyIds).some(Boolean) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteCompaniesOpen(true)}
                    className="gap-2"
                    disabled={isBulkDeletingCompanies}
                  >
                    {isBulkDeletingCompanies ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" /> Delete
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {loading ? (
              <div>Loading companies...</div>
            ) : companies.length ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        {(() => {
                          const items = companies.filter(
                            (c) => (c as any).companyType === "seller"
                          );
                          const some = items.some((c) => !!selectedCompanyIds[c.id]);
                          const all =
                            items.length > 0 && items.every((c) => !!selectedCompanyIds[c.id]);
                          return (
                            <Checkbox
                              checked={all || (some && "indeterminate")}
                              onCheckedChange={(v) => {
                                const checked = !!v;
                                setSelectedCompanyIds((prev) => {
                                  const next = { ...prev } as Record<string, boolean>;
                                  for (const c of items) {
                                    next[c.id] = checked;
                                  }
                                  return next;
                                });
                              }}
                              aria-label="Select all companies"
                            />
                          );
                        })()}
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="-ml-3"
                          onClick={() =>
                            setCompanySort((prev) => ({
                              key: "name",
                              order: prev.key === "name" && prev.order === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          Company
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="-ml-3"
                          onClick={() =>
                            setCompanySort((prev) => ({
                              key: "industry",
                              order:
                                prev.key === "industry" && prev.order === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          Industry
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="-ml-3"
                          onClick={() =>
                            setCompanySort((prev) => ({
                              key: "city",
                              order: prev.key === "city" && prev.order === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          Location
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies
                      .filter((c) => (c as any).companyType === "seller")
                      .filter((c) => {
                        const q = companyQuery.toLowerCase();
                        return (
                          !q ||
                          c.name.toLowerCase().includes(q) ||
                          c.industry.toLowerCase().includes(q) ||
                          (c.city || "").toLowerCase().includes(q)
                        );
                      })
                      .sort((a, b) => {
                        const dir = companySort.order === "asc" ? 1 : -1;
                        if (companySort.key === "name") {
                          return a.name.localeCompare(b.name) * dir;
                        }
                        if (companySort.key === "industry") {
                          return (a.industry || "").localeCompare(b.industry || "") * dir;
                        }
                        return (a.city || "").localeCompare(b.city || "") * dir;
                      })
                      .map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Checkbox
                              checked={!!selectedCompanyIds[c.id]}
                              onCheckedChange={(v) =>
                                setSelectedCompanyIds((prev) => ({
                                  ...prev,
                                  [c.id]: Boolean(v),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className="h-6 w-6 rounded-full"
                                style={{
                                  background:
                                    "radial-gradient(circle at 30% 30%, #ff80b5, #9089fc 55%, #7dd3fc)",
                                }}
                              />
                              <div className="space-y-0.5">
                                <div className="font-medium text-sm">{c.name}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex flex-col gap-1">
                              <span>{c.industry}</span>
                              <Badge
                                variant={
                                  (c as any).companyType === "seller" ? "default" : "secondary"
                                }
                              >
                                {(c as any).companyType === "seller" ? "Seller" : "Customer"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {c.city} {c.country}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCompanyToEdit(c);
                                  setEditCompanySource(
                                    (c.source as "account" | "customer") || "account"
                                  );
                                  setEditCompanyType(
                                    ((c as any).companyType as "seller" | "customer") || "seller"
                                  );
                                  setEditCompanyOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setCompanyToDeleteId(c.id);
                                  setDeleteCompanyOpen(true);
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No tenant companies</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="grid grid-cols-1 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">All Users</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setCreateUserOpen(true)}>
                  Create User
                </Button>
                <Input
                  placeholder="Search user..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="h-8 w-48"
                />
                {Object.values(selectedUserIds).some(Boolean) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteUsersOpen(true)}
                    className="gap-2"
                    disabled={isBulkDeletingUsers}
                  >
                    {isBulkDeletingUsers ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" /> Delete
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {loading ? (
              <div>Loading users...</div>
            ) : users.length ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        {(() => {
                          const items = users;
                          const some = items.some((u) => !!selectedUserIds[u.id]);
                          const all =
                            items.length > 0 && items.every((u) => !!selectedUserIds[u.id]);
                          return (
                            <Checkbox
                              checked={all || (some && "indeterminate")}
                              onCheckedChange={(v) => {
                                const checked = !!v;
                                setSelectedUserIds((prev) => {
                                  const next = { ...prev } as Record<string, boolean>;
                                  for (const u of items) {
                                    next[u.id] = checked;
                                  }
                                  return next;
                                });
                              }}
                              aria-label="Select all users"
                            />
                          );
                        })()}
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="-ml-3"
                          onClick={() =>
                            setUserSort((prev) => ({
                              key: "name",
                              order: prev.key === "name" && prev.order === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          User
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="-ml-3"
                          onClick={() =>
                            setUserSort((prev) => ({
                              key: "role",
                              order: prev.key === "role" && prev.order === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          Role
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          className="-ml-3"
                          onClick={() =>
                            setUserSort((prev) => ({
                              key: "status",
                              order: prev.key === "status" && prev.order === "asc" ? "desc" : "asc",
                            }))
                          }
                        >
                          Status
                          <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Manage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter((u) => {
                        const q = userQuery.toLowerCase();
                        const name = `${u.firstName} ${u.lastName}`.toLowerCase();
                        return (
                          !q ||
                          name.includes(q) ||
                          u.email.toLowerCase().includes(q) ||
                          u.role.toLowerCase().includes(q)
                        );
                      })
                      .sort((a, b) => {
                        const dir = userSort.order === "asc" ? 1 : -1;
                        if (userSort.key === "name") {
                          const an = `${a.firstName} ${a.lastName}`;
                          const bn = `${b.firstName} ${b.lastName}`;
                          return an.localeCompare(bn) * dir;
                        }
                        if (userSort.key === "role") {
                          return (a.role || "").localeCompare(b.role || "") * dir;
                        }
                        return (a.status || "").localeCompare(b.status || "") * dir;
                      })
                      .map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <Checkbox
                              checked={!!selectedUserIds[u.id]}
                              onCheckedChange={(v) =>
                                setSelectedUserIds((prev) => ({
                                  ...prev,
                                  [u.id]: Boolean(v),
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className="h-6 w-6 rounded-full"
                                style={{
                                  background:
                                    "radial-gradient(circle at 30% 30%, #ff80b5, #9089fc 55%, #7dd3fc)",
                                }}
                              />
                              <div className="space-y-0.5">
                                <div className="font-medium text-sm">
                                  {u.firstName} {u.lastName}
                                </div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{u.role}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                u.status === "active"
                                  ? "default"
                                  : u.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {u.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setUserToEdit(u);
                                  setEditUserForm({
                                    firstName: u.firstName || "",
                                    lastName: u.lastName || "",
                                    email: u.email || "",
                                    role: (u.role as "crm_user" | "tenant_admin") || "crm_user",
                                    status: u.status || "active",
                                  });
                                  setEditUserOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteUser(u.id)}
                                disabled={!!deletingUserIds[u.id]}
                                className="gap-2"
                              >
                                {deletingUserIds[u.id] ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                                  </>
                                ) : (
                                  <>Delete</>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No users</div>
            )}
          </div>
        </div>
      )}

      <DeleteDialog
        open={deleteCompaniesOpen}
        onOpenChange={setDeleteCompaniesOpen}
        title="Delete Companies"
        description="Are you sure you want to delete selected companies? This action cannot be undone."
        onConfirm={handleBulkDeleteCompanies}
        isLoading={isBulkDeletingCompanies}
      />

      <Dialog open={createCompanyOpen} onOpenChange={setCreateCompanyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Company</DialogTitle>
            <DialogDescription>Enter company details to create a new record.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              try {
                const res = await fetch(`/api/superadmin/tenants/${id}/companies`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...form,
                    source: createCompanySource,
                    companyType: createCompanyType,
                  }),
                });
                if (res.ok) {
                  setForm({ name: "", industry: "", address: "" });
                  setCreateCompanySource("account");
                  setCreateCompanyType("seller");
                  await fetchCompanies();
                  setCreateCompanyOpen(false);
                } else {
                  const err = await res.json();
                  alert(err.error?.message || "Failed to create company");
                }
              } catch (_error) {
                alert("Failed to create company");
              }
              setCreating(false);
            }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Label>Company Type (Seller/Customer)</Label>
              <Select
                value={createCompanyType}
                onValueChange={(v) => setCreateCompanyType(v as "seller" | "customer")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Seller Company (Uses CRM)</SelectItem>
                  <SelectItem value="customer">Customer Company (Client)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateCompanyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={deleteCompanyOpen}
        onOpenChange={(open) => {
          setDeleteCompanyOpen(open);
          if (!open) setCompanyToDeleteId(null);
        }}
        title="Delete Company"
        description="Are you sure you want to delete this company? This action cannot be undone."
        onConfirm={handleDeleteCompany}
        isLoading={isBulkDeletingCompanies}
      />

      <DeleteDialog
        open={deleteUsersOpen}
        onOpenChange={setDeleteUsersOpen}
        title="Delete Users"
        description="Are you sure you want to delete selected users? This action cannot be undone."
        onConfirm={handleBulkDeleteUsers}
        isLoading={isBulkDeletingUsers}
      />

      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Enter user details to create a new member.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              try {
                const pw = userForm.password.trim();
                const cpw = userForm.confirmPassword.trim();
                const strong = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
                if (!strong.test(pw)) {
                  setUserPasswordError(
                    "Lozinka mora imati najmanje 8 karaktera i bar jedno slovo i broj."
                  );
                  setCreating(false);
                  return;
                }
                if (pw !== cpw) {
                  setUserPasswordError("Lozinke se ne poklapaju.");
                  setCreating(false);
                  return;
                }
                if (userForm.role === "tenant_admin" && !createUserCompanyId) {
                  setUserCompanyError("Za Tenant Admin potrebno je izabrati kompaniju.");
                  setCreating(false);
                  return;
                }
                setUserPasswordError(null);
                setUserCompanyError(null);
                const res = await fetch(`/api/superadmin/tenants/${id}/users`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(userForm),
                });
                if (res.ok) {
                  const created = await res.json();
                  const createdUserId = created?.data?.id as string | undefined;
                  if (userForm.role === "tenant_admin" && createUserCompanyId && createdUserId) {
                    try {
                      const addRes = await fetch(
                        `/api/v1/companies/${createUserCompanyId}/members`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            userId: createdUserId,
                            role: "admin",
                          }),
                        }
                      );
                      if (!addRes.ok) {
                        const err = await addRes.json().catch(() => ({}));
                        alert(err.error?.message || "Dodavanje u kompaniju nije uspelo");
                      }
                    } catch (_error) {
                      alert("Dodavanje u kompaniju nije uspelo");
                    }
                  }
                  setUserForm({
                    firstName: "",
                    lastName: "",
                    email: "",
                    password: "",
                    confirmPassword: "",
                    role: "crm_user",
                  });
                  setCreateUserCompanyId(undefined);
                  await fetchUsers();
                  setCreateUserOpen(false);
                } else {
                  const err = await res.json();
                  alert(err.error?.message || "Failed to create user");
                }
              } catch (_error) {
                alert("Failed to create user");
              }
              setCreating(false);
            }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={userForm.firstName}
                onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={userForm.lastName}
                onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={userForm.confirmPassword}
                onChange={(e) => setUserForm({ ...userForm, confirmPassword: e.target.value })}
                required
                minLength={8}
              />
              {userPasswordError && (
                <p className="mt-1 text-xs text-destructive">{userPasswordError}</p>
              )}
            </div>
            {userForm.role === "tenant_admin" && (
              <div className="space-y-2">
                <Label>Kompanija (obavezno za Tenant Admin)</Label>
                <ComboboxDropdown
                  placeholder="Izaberi kompaniju"
                  searchPlaceholder="Pretraga kompanija..."
                  items={companies
                    .filter((c) => (c as any).source !== "customer")
                    .map((c) => ({ id: c.id, label: c.name }))}
                  selectedItem={
                    createUserCompanyId
                      ? companies
                          .filter((c) => (c as any).source !== "customer")
                          .map((c) => ({ id: c.id, label: c.name }))
                          .find((i) => i.id === createUserCompanyId)
                      : undefined
                  }
                  onSelect={(item) => setCreateUserCompanyId(item.id)}
                />
                {userCompanyError && (
                  <p className="mt-1 text-xs text-destructive">{userCompanyError}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                className="w-full border rounded px-3 py-2"
                value={userForm.role}
                onChange={(e) =>
                  setUserForm({
                    ...userForm,
                    role: e.target.value as "crm_user" | "tenant_admin",
                  })
                }
              >
                <option value="crm_user">CRM User</option>
                <option value="tenant_admin">Tenant Admin</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={editCompanyOpen} onOpenChange={setEditCompanyOpen}>
        <SheetContent>
          <SheetHeader className="mb-6">
            <h2 className="text-xl">Edit Company</h2>
          </SheetHeader>
          {companyToEdit && (
            <div className="mb-4 space-y-2">
              <Label>Company Type (Seller/Customer)</Label>
              <Select
                value={editCompanyType}
                onValueChange={(v) => setEditCompanyType(v as "seller" | "customer")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Seller Company (Uses CRM)</SelectItem>
                  <SelectItem value="customer">Customer Company (Client)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {companyToEdit && (
            <TenantCompanyForm
              company={companyToEdit}
              onSuccess={async () => {
                try {
                  if (
                    companyToEdit &&
                    (editCompanySource !== (companyToEdit.source as any) ||
                      editCompanyType !== ((companyToEdit as any).companyType as any))
                  ) {
                    await fetch(`/api/superadmin/tenants/${id}/companies/${companyToEdit.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        source: editCompanySource,
                        companyType: editCompanyType,
                      }),
                    });
                  }
                } catch {}
                setEditCompanyOpen(false);
                void fetchCompanies();
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <UserEditSheet
        open={editUserOpen}
        onOpenChange={setEditUserOpen}
        userToEdit={userToEdit}
        editUserForm={editUserForm}
        setEditUserForm={setEditUserForm}
        id={id}
        fetchUsers={fetchUsers}
        creating={creating}
        setCreating={setCreating}
        companies={companies}
      />
    </div>
  );
}
