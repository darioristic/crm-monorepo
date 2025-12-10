"use client";

import { useQuery } from "@tanstack/react-query";
import { type AuthUser, getCurrentUser } from "@/lib/auth";

export function useUserQuery() {
  return useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const result = await getCurrentUser();
      if (!result.success || !result.data) {
        throw new Error(result.error?.message || "Failed to fetch user");
      }
      return result.data;
    },
    staleTime: 60 * 1000,
  });
}

// Export type for compatibility
export type User = AuthUser;
