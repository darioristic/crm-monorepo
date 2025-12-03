"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { OrderTitle } from "./order-title";
import { OrderNo } from "./order-no";
import { IssueDate } from "./issue-date";
import { LabelInput } from "./label-input";
import type { FormValues } from "./form-context";

export function Meta() {
  const { control } = useFormContext<FormValues>();

  return (
    <div className="flex flex-col">
      <OrderTitle />

      <div className="flex flex-col space-y-2 mt-3">
        <div className="flex items-center gap-2">
          <OrderNo />
        </div>

        <div className="flex items-center space-x-2">
          <LabelInput
            name="template.issueDateLabel"
            className="text-[11px] text-[#878787] w-[70px]"
          />
          <IssueDate />
        </div>
      </div>
    </div>
  );
}

