"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { InvoiceTitle } from "./invoice-title";
import { InvoiceNo } from "./invoice-no";
import { IssueDate } from "./issue-date";
import { DueDate } from "./due-date";
import { LabelInput } from "./label-input";
import type { FormValues } from "./form-context";

export function Meta() {
  const { control } = useFormContext<FormValues>();
  const issueDateLabel = useWatch({ control, name: "template.issueDateLabel" });
  const dueDateLabel = useWatch({ control, name: "template.dueDateLabel" });

  return (
    <div className="flex flex-col">
      <InvoiceTitle />

      <div className="flex flex-col space-y-2 mt-3">
        <div className="flex items-center gap-2">
          <InvoiceNo />
        </div>

        <div className="flex items-center space-x-2">
          <LabelInput
            name="template.issueDateLabel"
            className="text-[11px] text-[#878787] w-[70px]"
          />
          <IssueDate />
        </div>

        <div className="flex items-center space-x-2">
          <LabelInput
            name="template.dueDateLabel"
            className="text-[11px] text-[#878787] w-[70px]"
          />
          <DueDate />
        </div>
      </div>
    </div>
  );
}
