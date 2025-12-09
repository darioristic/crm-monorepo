"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/contexts/tenant-context";
import { request } from "@/lib/api";

export default function WorkspaceSettingsPage() {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ [k: string]: any }>({
    name: "",
    industry: "",
    address: "",
    email: "",
    phone: "",
    website: "",
    vatNumber: "",
    companyNumber: "",
    contact: "",
    city: "",
    zip: "",
    country: "",
    countryCode: "",
    note: "",
  });

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/v1/companies/current", {
          credentials: "include",
        });
        const data = await res.json();
        const company = data?.data || {};
        setForm((prev) => ({
          ...prev,
          name: company.name || "",
          industry: company.industry || "",
          address: company.address || "",
          email: company.email || "",
          phone: company.phone || "",
          website: company.website || "",
          vatNumber: company.vatNumber || "",
          companyNumber: company.companyNumber || "",
          contact: company.contact || "",
          city: company.city || "",
          zip: company.zip || "",
          country: company.country || "",
          countryCode: company.countryCode || "",
          note: company.note || "",
        }));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const onChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const result = await request<any>("/api/v1/companies/current", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      if (result.success) {
        toast.success("Workspace updated");
      } else {
        toast.error(result.error?.message ?? "Failed to update workspace");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace Settings</h1>
          <p className="text-muted-foreground">Company details and team overview</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/settings/members">Manage Members</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>Current tenant information</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={onChange("name")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" value={form.industry} onChange={onChange("industry")} />
              </div>
              <div className="md:col-span-2 grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address} onChange={onChange("address")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={onChange("email")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={onChange("phone")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website} onChange={onChange("website")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vatNumber">VAT</Label>
                <Input id="vatNumber" value={form.vatNumber} onChange={onChange("vatNumber")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="companyNumber">Company No</Label>
                <Input
                  id="companyNumber"
                  value={form.companyNumber}
                  onChange={onChange("companyNumber")}
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={onSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>Members belonging to this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/dashboard/settings/members">Open Members</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/tenant-admin/users">Tenant Users</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
