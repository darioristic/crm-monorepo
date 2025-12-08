"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logger } from "@/lib/logger";

export default function ProvisionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    adminEmail: "",
    adminPassword: "",
    adminFirstName: "",
    adminLastName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/superadmin/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/superadmin/tenants/${data.data.tenantId}`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error?.message || "Provisioning failed"}`);
      }
    } catch (error) {
      logger.error("Error provisioning tenant:", error);
      alert("Failed to provision tenant");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Provision New Tenant</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tenant Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tenant Slug</label>
          <input
            type="text"
            required
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Admin First Name</label>
          <input
            type="text"
            required
            value={formData.adminFirstName}
            onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Admin Last Name</label>
          <input
            type="text"
            required
            value={formData.adminLastName}
            onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Admin Email</label>
          <input
            type="email"
            required
            value={formData.adminEmail}
            onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Admin Password</label>
          <input
            type="password"
            required
            value={formData.adminPassword}
            onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
        >
          {loading ? "Provisioning..." : "Provision Tenant"}
        </button>
      </form>
    </div>
  );
}
