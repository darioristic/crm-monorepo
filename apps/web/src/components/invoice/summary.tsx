"use client";

import { useCallback, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { calculateTotal, formatInvoiceAmount } from "@/utils/invoice-calculate";

export function Summary() {
  const { control, setValue } = useFormContext();

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

  const lineItems = useWatch({
    control,
    name: "lineItems",
  });

  // Calculate all values automatically from line items
  const {
    grossTotal,
    subTotal,
    total,
    vat: totalVAT,
    tax: totalTax,
    discountAmount,
  } = calculateTotal({
    lineItems,
    taxRate,
    vatRate,
    includeVat,
    includeTax,
  });

  // Update form values when calculations change
  const updateFormValues = useCallback(() => {
    setValue("amount", total, { shouldValidate: true });
    setValue("vat", totalVAT, { shouldValidate: true });
    setValue("tax", totalTax, { shouldValidate: true });
    setValue("subtotal", subTotal, { shouldValidate: true });
    setValue("discount", discountAmount, { shouldValidate: true });
  }, [total, totalVAT, totalTax, subTotal, discountAmount, setValue]);

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

  return (
    <div className="w-[320px] flex flex-col">
      {/* Amount before discount */}
      <div className="flex justify-between items-center py-1">
        <span className="text-[11px] text-[#878787]">Amount before discount:</span>
        <span className="text-right text-[11px] text-[#878787] font-mono">
          {formatInvoiceAmount({
            amount: grossTotal,
            maximumFractionDigits: 2,
            currency: currency || "EUR",
            locale: locale || "sr-RS",
          })}
        </span>
      </div>

      {/* Discount */}
      <div className="flex justify-between items-center py-1">
        <span className="text-[11px] text-[#878787]">Discount:</span>
        <span className="text-right text-[11px] text-[#878787] font-mono">
          -
          {formatInvoiceAmount({
            amount: discountAmount,
            maximumFractionDigits: 2,
            currency: currency || "EUR",
            locale: locale || "sr-RS",
          })}
        </span>
      </div>

      {/* Subtotal */}
      <div className="flex justify-between items-center py-1">
        <span className="text-[11px] text-[#878787]">Subtotal:</span>
        <span className="text-right text-[11px] text-[#878787] font-mono">
          {formatInvoiceAmount({
            amount: subTotal,
            maximumFractionDigits: 2,
            currency: currency || "EUR",
            locale: locale || "sr-RS",
          })}
        </span>
      </div>

      {/* VAT Amount */}
      <div className="flex justify-between items-center py-1">
        <span className="text-[11px] text-[#878787]">VAT Amount ({vatRate || 20}%):</span>
        <span className="text-right text-[11px] text-[#878787] font-mono">
          {formatInvoiceAmount({
            amount: totalVAT,
            maximumFractionDigits: 2,
            currency: currency || "EUR",
            locale: locale || "sr-RS",
          })}
        </span>
      </div>

      {/* Tax - only if enabled */}
      {includeTax && (
        <div className="flex justify-between items-center py-1">
          <span className="text-[11px] text-[#878787]">Tax ({taxRate}%):</span>
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

      {/* Total */}
      <div className="flex justify-between items-center py-4 mt-2 border-t border-border">
        <span className="text-[11px] text-[#878787]">Total:</span>
        <span className="text-right font-medium text-[21px] font-mono">
          {formatInvoiceAmount({
            amount: total,
            maximumFractionDigits: 2,
            currency: currency || "EUR",
            locale: locale || "sr-RS",
          })}
        </span>
      </div>
    </div>
  );
}
