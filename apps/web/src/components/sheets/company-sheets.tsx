"use client";

import { CompanyCreateSheet } from "../companies/company-create-sheet";
import { CompanyEditSheet } from "../companies/company-edit-sheet";

export function CompanySheets() {
  return (
    <>
      <CompanyCreateSheet />
      <CompanyEditSheet />
    </>
  );
}
