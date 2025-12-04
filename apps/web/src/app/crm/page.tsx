"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Company {
  id: string;
  name: string;
  industry: string;
}

export default function CRMPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const companyId =
    searchParams.get("companyId") || localStorage.getItem("selectedCompanyId");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch("/api/crm/companies");
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (companyId: string) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/crm/companies/${companyId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Company deleted successfully");
        await fetchCompanies();
        // If deleted company was selected, clear selection
        if (id === companyId) {
          localStorage.removeItem("selectedCompanyId");
          router.push("/crm");
        }
      } else {
        const data = await response.json();
        toast.error(data.error?.message || "Failed to delete company");
      }
    } catch (error) {
      console.error("Error deleting company:", error);
      toast.error("Failed to delete company");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!companyId) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Select a Company</h2>
          <Button
            onClick={() => router.push("/dashboard/companies/create")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        </div>
        <div className="grid gap-4">
          {companies.map((company) => (
            <div
              key={company.id}
              className="border rounded-lg p-4 hover:bg-accent transition-colors flex items-center justify-between group"
            >
              <Link href={`/crm?companyId=${company.id}`} className="flex-1">
                <h3 className="font-semibold">{company.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {company.industry}
                </p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setCompanyToDelete(company.id);
                  setDeleteDialogOpen(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {companies.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>
                No companies found. Create your first company to get started.
              </p>
              <Button
                onClick={() => router.push("/dashboard/companies/create")}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Company
              </Button>
            </div>
          )}
        </div>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                company and all associated data (contacts, documents,
                activities, invoices, quotes, invoices, orders).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => companyToDelete && handleDelete(companyToDelete)}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">CRM Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={`/crm/companies/${companyId}/documents`}
          className="border rounded-lg p-6 hover:bg-accent transition-colors"
        >
          <h3 className="font-semibold mb-2">Documents</h3>
          <p className="text-sm text-muted-foreground">
            View and manage company documents
          </p>
        </Link>

        <Link
          href={`/crm/companies/${companyId}/contacts`}
          className="border rounded-lg p-6 hover:bg-accent transition-colors"
        >
          <h3 className="font-semibold mb-2">Contacts</h3>
          <p className="text-sm text-muted-foreground">
            Manage company contacts
          </p>
        </Link>

        <Link
          href={`/crm/companies/${companyId}/activities`}
          className="border rounded-lg p-6 hover:bg-accent transition-colors"
        >
          <h3 className="font-semibold mb-2">Activities</h3>
          <p className="text-sm text-muted-foreground">
            View company activities
          </p>
        </Link>
      </div>
    </div>
  );
}
