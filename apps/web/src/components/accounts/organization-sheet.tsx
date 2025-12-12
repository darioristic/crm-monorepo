"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CompanyFormSheet } from "./company-form-sheet";

type OrganizationSheetProps = {
  onSaved?: () => void;
};

export function OrganizationSheet({ onSaved }: OrganizationSheetProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const type = searchParams.get("type") as "create" | "edit" | null;
  const organizationId = searchParams.get("organizationId");
  const isOpen = type === "create" || type === "edit";

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        router.push(pathname);
      }
    },
    [router, pathname]
  );

  const handleSaved = useCallback(() => {
    onSaved?.();
  }, [onSaved]);

  return (
    <CompanyFormSheet
      open={isOpen}
      onOpenChange={handleOpenChange}
      companyId={type === "edit" ? organizationId || undefined : undefined}
      onSaved={handleSaved}
    />
  );
}
