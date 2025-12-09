"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useUserQuery } from "@/hooks/use-user";
import { deleteCompany } from "@/lib/companies";

export function DeleteTeam() {
  const [value, setValue] = useState("");
  const { data: user } = useUserQuery();
  const router = useRouter();
  const queryClient = useQueryClient();

  const deleteTeamMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const result = await deleteCompany(companyId);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to delete team");
      }
      return result;
    },
    onSuccess: async () => {
      // Invalidate queries and redirect
      queryClient.invalidateQueries();
      toast.success("Team deleted successfully");
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete team");
    },
  });

  const companyId = user?.companyId;

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium text-destructive">Delete Company</CardTitle>
        <CardDescription className="text-sm">
          Permanently remove your company and all of its contents. This action is not reversible —
          please continue with caution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Once you delete a company, there is no going back. All data, members, and settings will be
          permanently removed.
        </p>
      </CardContent>
      <CardFooter className="flex justify-end border-t border-destructive/20 pt-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2">
              Delete Company
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your company and remove
                all data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-2 mt-4">
              <Label htmlFor="confirm-delete" className="text-sm font-medium">
                Type <span className="font-semibold text-destructive">DELETE</span> to confirm.
              </Label>
              <Input
                id="confirm-delete"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (companyId) {
                    deleteTeamMutation.mutate(companyId);
                  }
                }}
                disabled={value !== "DELETE" || !companyId || deleteTeamMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteTeamMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete Company"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
