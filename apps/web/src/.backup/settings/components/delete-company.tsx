"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { deleteCompany, getCurrentCompany } from "@/lib/companies";

export function DeleteCompany() {
  const [value, setValue] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: _user } = useAuth();

  const { data: companyResponse } = useQuery({
    queryKey: ["company", "current"],
    queryFn: getCurrentCompany,
  });

  const company = companyResponse?.data;

  const deleteCompanyMutation = useMutation({
    mutationFn: async () => {
      if (!company?.id) {
        throw new Error("No company selected");
      }
      const result = await deleteCompany(company.id);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to delete company");
      }
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Company deleted successfully");
      router.push("/dashboard/companies");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete company");
    },
  });

  if (!company) {
    return null;
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>Delete Company</CardTitle>
        <CardDescription>
          Permanently remove your Company and all of its contents from the CRM platform. This action
          is not reversible — please continue with caution.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex justify-between">
        <div />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="hover:bg-destructive">
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your company and remove
                all associated data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-2 mt-2">
              <Label htmlFor="confirm-delete">
                Type <span className="font-medium">DELETE</span> to confirm.
              </Label>
              <Input
                id="confirm-delete"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="DELETE"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteCompanyMutation.mutate()}
                disabled={value !== "DELETE" || deleteCompanyMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteCompanyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Confirm"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
