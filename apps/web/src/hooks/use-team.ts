"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { getCompanyMembers, getCurrentCompany, updateCompany } from "@/lib/companies";

export function useTeamQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["team", "current", user?.companyId], // Include companyId in query key to refetch when it changes
    queryFn: async () => {
      const result = await getCurrentCompany();
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || "Failed to fetch team");
      }
      // Map Company to Team-like structure
      return {
        id: result.data.id,
        name: result.data.name,
        email: result.data.email || null,
        logoUrl: result.data.logoUrl || null,
        countryCode: result.data.countryCode || null,
        baseCurrency: null, // Not in current Company model
        fiscalYearStartMonth: null, // Not in current Company model
      } as Team;
    },
    enabled: !!user?.companyId, // Only fetch if user has a company
    staleTime: 0, // Always fetch fresh data when company changes
  });
}

export function useTeamMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Partial<Team>) => {
      // Get current company first
      const currentResult = await getCurrentCompany();
      if (!currentResult.success || !currentResult.data) {
        throw new Error("No company selected");
      }

      // Allow admin roles to proceed without membership check
      const role = user?.role;
      const isAdminRole = role === "superadmin" || role === "tenant_admin" || role === "admin";
      if (!isAdminRole) {
        const membersResult = await getCompanyMembers(currentResult.data.id);
        if (!membersResult.success || !membersResult.data) {
          throw new Error(membersResult.error?.message || "Failed to verify membership");
        }
        const isMember = membersResult.data.some((m) => m.id === user?.id);
        if (!isMember) {
          throw new Error("You are not a member of this company");
        }
      }

      // Map Team fields to Company fields
      const updateData: {
        name?: string;
        email?: string;
        logoUrl?: string;
      } = {};

      if (data.name !== undefined) updateData.name = data.name || undefined;
      if (data.email !== undefined) updateData.email = data.email || undefined;
      if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl || undefined;

      const result = await updateCompany(currentResult.data.id, updateData);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to update team");
      }
      return result.data;
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["team", "current"] });

      // Get current data
      const previousData = queryClient.getQueryData<Team>(["team", "current"]);

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<Team>(["team", "current"], {
          ...previousData,
          ...newData,
        });
      }

      return { previousData };
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["team", "current"], context.previousData);
      }
      toast.error("Failed to update team");
    },
    onSuccess: () => {
      toast.success("Team updated successfully");
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["team", "current"] });
    },
  });
}

// Team type matching midday structure
export type Team = {
  id: string;
  name: string | null;
  email: string | null;
  logoUrl: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
  fiscalYearStartMonth: number | null;
};
