"use client";

import { useEffect, useState } from "react";
import { useCompanyParams } from "@/hooks/use-company-params";
import { companiesApi } from "@/lib/api";
import { useMutation } from "@/hooks/use-api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { CompanyForm, type CompanyData } from "./company-form";
import { Skeleton } from "@/components/ui/skeleton";

export function CompanyEditSheet() {
  const { setParams, companyId } = useCompanyParams();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = Boolean(companyId);

  useEffect(() => {
    if (companyId) {
      setIsLoading(true);
      companiesApi.getById(companyId)
        .then((response) => {
          if (response.data) {
            setCompany(response.data as CompanyData);
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setCompany(null);
    }
  }, [companyId]);

  const deleteMutation = useMutation<void, string>((id) =>
    companiesApi.delete(id)
  );

  const handleDelete = async () => {
    if (!companyId) return;
    const result = await deleteMutation.mutate(companyId);
    if (result.success) {
      setParams(null);
      window.location.reload();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={() => setParams(null)}>
      <SheetContent>
        <SheetHeader className="mb-6 flex justify-between items-center flex-row">
          <h2 className="text-xl">Edit Company</h2>

          {companyId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button">
                  <MoreVertical className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent sideOffset={10} align="end">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the company and remove their data from our
                        servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <CompanyForm data={company ?? undefined} key={company?.id} />
        )}
      </SheetContent>
    </Sheet>
  );
}
