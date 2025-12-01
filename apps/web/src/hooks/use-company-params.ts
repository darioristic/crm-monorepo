"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface CompanyParams {
  companyId?: string | null;
  createCompany?: boolean;
  name?: string | null;
  q?: string | null;
}

export function useCompanyParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const companyId = searchParams.get("companyId");
  const createCompany = searchParams.get("createCompany") === "true";
  const name = searchParams.get("name");
  const q = searchParams.get("q");

  const setParams = useCallback(
    (params: Partial<CompanyParams> | null) => {
      const newSearchParams = new URLSearchParams(searchParams.toString());

      if (params === null) {
        newSearchParams.delete("companyId");
        newSearchParams.delete("createCompany");
        newSearchParams.delete("name");
      } else {
        if (params.companyId !== undefined) {
          if (params.companyId) {
            newSearchParams.set("companyId", params.companyId);
          } else {
            newSearchParams.delete("companyId");
          }
        }

        if (params.createCompany !== undefined) {
          if (params.createCompany) {
            newSearchParams.set("createCompany", "true");
          } else {
            newSearchParams.delete("createCompany");
          }
        }

        if (params.name !== undefined) {
          if (params.name) {
            newSearchParams.set("name", params.name);
          } else {
            newSearchParams.delete("name");
          }
        }

        if (params.q !== undefined) {
          if (params.q) {
            newSearchParams.set("q", params.q);
          } else {
            newSearchParams.delete("q");
          }
        }
      }

      const newUrl = newSearchParams.toString()
        ? `${pathname}?${newSearchParams.toString()}`
        : pathname;

      router.push(newUrl, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return {
    companyId,
    createCompany,
    name,
    q,
    setParams,
  };
}

