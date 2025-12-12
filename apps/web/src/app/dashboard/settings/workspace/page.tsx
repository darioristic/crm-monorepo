"use client";

import type { Company } from "@crm/types";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { request } from "@/lib/api";

export default function WorkspaceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Partial<Company>>({
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
    logoUrl: "",
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
          logoUrl: company.logoUrl || "",
        }));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }

    setUploadingLogo(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setForm((prev) => ({ ...prev, logoUrl: base64 }));
        setUploadingLogo(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to upload logo");
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, logoUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onChange =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const onSave = async () => {
    setSaving(true);
    try {
      const result = await request<Company>("/api/v1/companies/current", {
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name ?? ""} onChange={onChange("name")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" value={form.industry ?? ""} onChange={onChange("industry")} />
              </div>
              <div className="lg:col-span-2 grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={form.address ?? ""} onChange={onChange("address")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={onChange("email")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone ?? ""} onChange={onChange("phone")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website ?? ""} onChange={onChange("website")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vatNumber">VAT</Label>
                <Input
                  id="vatNumber"
                  value={form.vatNumber ?? ""}
                  onChange={onChange("vatNumber")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="companyNumber">Company No</Label>
                <Input
                  id="companyNumber"
                  value={form.companyNumber ?? ""}
                  onChange={onChange("companyNumber")}
                />
              </div>
              <Separator className="lg:col-span-2" />
              <div className="grid gap-2">
                <Label htmlFor="contact">Primary Contact</Label>
                <Input id="contact" value={form.contact ?? ""} onChange={onChange("contact")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city ?? ""} onChange={onChange("city")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input id="zip" value={form.zip ?? ""} onChange={onChange("zip")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={form.country ?? ""} onChange={onChange("country")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="countryCode">Country Code</Label>
                <Input
                  id="countryCode"
                  value={form.countryCode ?? ""}
                  onChange={onChange("countryCode")}
                />
              </div>
              <div className="lg:col-span-2 grid gap-2">
                <Label htmlFor="note">Notes</Label>
                <Textarea id="note" rows={3} value={form.note ?? ""} onChange={onChange("note")} />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Logo Card */}
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Company logo for invoices, quotes and documents</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="relative w-40 h-40 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {form.logoUrl ? (
                  <>
                    <Image fill src={form.logoUrl} alt="Company logo" className="object-contain" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={handleRemoveLogo}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Logo
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Max 2MB.</p>
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
