"use client";

import { calculateTotal, formatInvoiceAmount } from "@/utils/invoice-calculate";
import { useCallback, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AmountInput } from "./amount-input";
import { LabelInput } from "./label-input";
import { TaxInput } from "./tax-input";
import { VatInput } from "./vat-input";

export function Summary() {
  const { control, setValue } = useFormContext();

  const includeDecimals = useWatch({
    control,
    name: "template.includeDecimals",
  });

  const maximumFractionDigits = includeDecimals ? 2 : 0;

  const currency = useWatch({
    control,
    name: "template.currency",
  });

  const locale = useWatch({
    control,
    name: "template.locale",
  });

  const includeTax = useWatch({
    control,
    name: "template.includeTax",
  });

  const taxRate = useWatch({
    control,
    name: "template.taxRate",
  });

  const vatRate = useWatch({
    control,
    name: "template.vatRate",
  });

  const includeVat = useWatch({
    control,
    name: "template.includeVat",
  });

  const includeDiscount = useWatch({
    control,
    name: "template.includeDiscount",
  });

  const lineItems = useWatch({
    control,
    name: "lineItems",
  });

  const discount = useWatch({
    control,
    name: "discount",
  });

  const {
    subTotal,
    total,
    vat: totalVAT,
    tax: totalTax,
  } = calculateTotal({
    lineItems,
    taxRate,
    vatRate,
    includeVat,
    includeTax,
    discount: discount ?? 0,
  });

  const updateFormValues = useCallback(() => {
    setValue("amount", total, { shouldValidate: true });
    setValue("vat", totalVAT, { shouldValidate: true });
    setValue("tax", totalTax, { shouldValidate: true });
    setValue("subtotal", subTotal, { shouldValidate: true });
    setValue("discount", discount ?? 0, { shouldValidate: true });
  }, [total, totalVAT, totalTax, subTotal, discount, setValue]);

  useEffect(() => {
    updateFormValues();
  }, [updateFormValues]);

  useEffect(() => {
    if (!includeTax) {
      setValue("template.taxRate", 0, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [includeTax, setValue]);

  useEffect(() => {
    if (!includeVat) {
      setValue("template.vatRate", 0, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [includeVat, setValue]);

  useEffect(() => {
    if (!includeDiscount) {
      setValue("discount", 0, { shouldValidate: true, shouldDirty: true });
    }
  }, [includeDiscount, setValue]);

  return (
    <div className="w-[320px] flex flex-col">
      <div className="flex justify-between items-center py-1">
        <LabelInput
          className="flex-shrink-0 min-w-6"
          name="template.subtotalLabel"
        />
        <span className="text-right text-[11px] text-[#878787] font-mono">
          {formatInvoiceAmount({
            amount: subTotal,
            maximumFractionDigits,
            currency: currency || "EUR",
            locale: locale || "sr-RS",
          })}
        </span>
      </div>

      {includeDiscount && (
        <div className="flex justify-between items-center py-1">
          <LabelInput name="template.discountLabel" />

          <AmountInput
            placeholder="0"
            name="discount"
            className="text-right text-[11px] text-[#878787] border-none w-24"
          />
        </div>
      )}

      {includeVat && (
        <div className="flex justify-between items-center py-1">
          <div className="flex items-center gap-1">
            <LabelInput
              className="flex-shrink-0 min-w-5"
              name="template.vatLabel"
            />
            <VatInput />
          </div>

          <span className="text-right text-[11px] text-[#878787] font-mono">
            {formatInvoiceAmount({
              amount: totalVAT,
              maximumFractionDigits: 2,
              currency: currency || "EUR",
              locale: locale || "sr-RS",
            })}
          </span>
        </div>
      )}

      {includeTax && (
        <div className="flex justify-between items-center py-1">
          <div className="flex items-center gap-1">
            <LabelInput
              className="flex-shrink-0 min-w-5"
              name="template.taxLabel"
            />
            <TaxInput />
          </div>

          <span className="text-right text-[11px] text-[#878787] font-mono">
            {formatInvoiceAmount({
              amount: totalTax,
              maximumFractionDigits: 2,
              currency: currency || "EUR",
              locale: locale || "sr-RS",
            })}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center py-4 mt-2 border-t border-border">
        <LabelInput name="template.totalSummaryLabel" />
        <span className="text-right font-medium text-[21px] font-mono">
          {formatInvoiceAmount({
            amount: total,
            maximumFractionDigits:
              includeTax || includeVat ? 2 : maximumFractionDigits,
            currency: currency || "EUR",
            locale: locale || "sr-RS",
          })}
        </span>
      </div>
    </div>
  );
}
