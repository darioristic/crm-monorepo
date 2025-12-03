"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { QuoteTitle } from "./quote-title";
import { QuoteNo } from "./quote-no";
import { IssueDate } from "./issue-date";
import { ValidUntil } from "./valid-until";
import { LabelInput } from "./label-input";
import type { FormValues } from "./form-context";

export function Meta() {
  const { control } = useFormContext<FormValues>();
  const issueDateLabel = useWatch({ control, name: "template.issueDateLabel" });
  const validUntilLabel = useWatch({ control, name: "template.validUntilLabel" });

  return (
    <div className="flex flex-col">
      <QuoteTitle />

      <div className="flex flex-col space-y-2 mt-3">
        <div className="flex items-center gap-2">
          <QuoteNo />
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
            name="template.validUntilLabel"
            className="text-[11px] text-[#878787] w-[70px]"
          />
          <ValidUntil />
        </div>
      </div>
    </div>
  );
}

