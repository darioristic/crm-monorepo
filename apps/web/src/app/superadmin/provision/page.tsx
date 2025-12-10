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
    adminConfirmPassword: "",
    adminFirstName: "",
    adminLastName: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const pw = formData.adminPassword.trim();
      const cpw = formData.adminConfirmPassword.trim();
      const strong = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
      if (!strong.test(pw)) {
        setPasswordError("Lozinka mora imati najmanje 8 karaktera i bar jedno slovo i broj.");
        setLoading(false);
        return;
      }
      if (pw !== cpw) {
        setPasswordError("Lozinke se ne poklapaju.");
        setLoading(false);
        return;
      }
      setPasswordError(null);

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
          <label htmlFor="tenantName" className="block text-sm font-medium mb-1">
            Tenant Name
          </label>
          <input
            id="tenantName"
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="tenantSlug" className="block text-sm font-medium mb-1">
            Tenant Slug
          </label>
          <input
            id="tenantSlug"
            type="text"
            required
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="adminFirstName" className="block text-sm font-medium mb-1">
            Admin First Name
          </label>
          <input
            id="adminFirstName"
            type="text"
            required
            value={formData.adminFirstName}
            onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="adminLastName" className="block text-sm font-medium mb-1">
            Admin Last Name
          </label>
          <input
            id="adminLastName"
            type="text"
            required
            value={formData.adminLastName}
            onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="adminEmail" className="block text-sm font-medium mb-1">
            Admin Email
          </label>
          <input
            id="adminEmail"
            type="email"
            required
            value={formData.adminEmail}
            onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="adminPassword" className="block text-sm font-medium mb-1">
            Admin Password
          </label>
          <input
            id="adminPassword"
            type="password"
            required
            value={formData.adminPassword}
            onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="adminConfirmPassword" className="block text-sm font-medium mb-1">
            Confirm Password
          </label>
          <input
            id="adminConfirmPassword"
            type="password"
            required
            value={formData.adminConfirmPassword}
            onChange={(e) => setFormData({ ...formData, adminConfirmPassword: e.target.value })}
            className="w-full px-3 py-2 border rounded-md"
          />
          {passwordError && <p className="mt-1 text-xs text-destructive">{passwordError}</p>}
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
