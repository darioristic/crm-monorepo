"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

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
        <Link
          href="/superadmin/provision"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Provision New Tenant
        </Link>
      </div>

      <div className="grid gap-4">
        {tenants.map((tenant) => (
          <div key={tenant.id} className="border rounded-lg p-4 flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{tenant.name}</h3>
              <p className="text-sm text-muted-foreground">{tenant.slug}</p>
              <p className="text-sm">
                Status:{" "}
                <span
                  className={
                    tenant.status === "active"
                      ? "text-green-600"
                      : tenant.status === "suspended"
                        ? "text-yellow-600"
                        : "text-red-600"
                  }
                >
                  {tenant.status}
                </span>
              </p>
            </div>
            <Link
              href={`/superadmin/tenants/${tenant.id}`}
              className="text-sm text-primary hover:underline"
            >
              View Details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
