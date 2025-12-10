"use client";

import type { Milestone } from "@crm/types";
import { AlertCircle } from "lucide-react";
import { use } from "react";
import { MilestoneForm } from "@/components/projects/milestone-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { milestonesApi } from "@/lib/api";

interface EditMilestonePageProps {
  params: Promise<{ id: string }>;
}

export default function EditMilestonePage({ params }: EditMilestonePageProps) {
  const { id } = use(params);

  const {
    data: milestone,
    isLoading,
    error,
  } = useApi<Milestone>(() => milestonesApi.getById(id), { autoFetch: true });

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!milestone) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Milestone not found</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-3xl">
      <MilestoneForm milestone={milestone} mode="edit" />
    </div>
  );
}
