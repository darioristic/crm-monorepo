"use client";

import { useCompanyParams } from "@/hooks/use-company-params";
import { companiesApi } from "@/lib/api";
import { useApi, useMutation } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { MoreVertical, X, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CompanyFormEnhanced, type EnhancedCompany } from "./company-form-enhanced";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

export function CompanyEditSheet() {
  const { setParams, companyId } = useCompanyParams();
  const [company, setCompany] = useState<EnhancedCompany | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = Boolean(companyId);

  // Fetch company data when sheet opens
  useEffect(() => {
    if (companyId) {
      setIsLoading(true);
      companiesApi.getById(companyId)
        .then((response) => {
          if (response.data) {
            setCompany(response.data as EnhancedCompany);
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
      // Optionally trigger a refetch of the companies list
      window.location.reload();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={() => setParams(null)}>
      <SheetContent className="sm:max-w-[540px] overflow-hidden">
        <SheetHeader className="mb-6 flex flex-row justify-between items-center">
          <SheetTitle className="text-xl">Edit Company</SheetTitle>
          
          <div className="flex items-center gap-2">
            {companyId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete Company?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete the company and may affect related invoices,
                          quotes, and other records.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setParams(null)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : company ? (
          <CompanyFormEnhanced data={company} key={company.id} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

