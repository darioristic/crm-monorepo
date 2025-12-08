"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

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

export default function TenantDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", address: "" });

  useEffect(() => {
    void fetchTenant();
    void fetchCompanies();
  }, [id]);

  const fetchTenant = async () => {
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}`);
      const data = await res.json();
      setTenant(data.data || null);
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

  const createCompany = async (e: React.FormEvent) => {
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

  if (!tenant) {
    return <div>Loading tenant...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{tenant.name}</h2>
          <p className="text-muted-foreground">Slug: {tenant.slug}</p>
        </div>
        <button className="px-3 py-2 border rounded" onClick={() => router.push("/superadmin")}>
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-2">Companies</h3>
          {loading ? (
            <div>Loading companies...</div>
          ) : companies.length ? (
            <ul className="space-y-2">
              {companies.map((c) => (
                <li key={c.id} className="border rounded p-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-muted-foreground">{c.industry}</div>
                  <div className="text-sm">
                    {c.city} {c.country}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">No companies</div>
          )}
        </div>

        <div>
          <h3 className="font-semibold mb-2">Create Company</h3>
          <form onSubmit={createCompany} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Industry</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Address</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
