"use client";

import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, Plus, X } from "lucide-react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { LabelInput } from "@/components/invoice/label-input";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { calculateLineItemTotal, formatOrderAmount } from "@/utils/order-calculate";
import type { FormValues } from "./form-context";
import { ProductAutocomplete } from "./product-autocomplete";
import { ProductAwareAmountInput } from "./product-aware-amount-input";
import { ProductAwareUnitInput } from "./product-aware-unit-input";

export function LineItems() {
  const { control } = useFormContext<FormValues>();
  const currency = useWatch({ control, name: "template.currency" });
  const locale = useWatch({ control, name: "template.locale" });

  const includeDecimals = useWatch({
    control,
    name: "template.includeDecimals",
  });

  const includeUnits = useWatch({
    control,
    name: "template.includeUnits",
  });

  const includeDiscount = useWatch({
    control,
    name: "template.includeDiscount",
  });

  const includeVat = useWatch({
    control,
    name: "template.includeVat",
  });

  const maximumFractionDigits = includeDecimals ? 2 : 0;

  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: "lineItems",
  });

  const reorderList = (newFields: typeof fields) => {
    const firstDiffIndex = fields.findIndex((field, index) => field.id !== newFields[index]?.id);

    if (firstDiffIndex !== -1) {
      const newIndex = newFields.findIndex((field) => field.id === fields[firstDiffIndex]?.id);

      if (newIndex !== -1) {
        swap(firstDiffIndex, newIndex);
      }
    }
  };

  const handleRemove = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // Dynamic grid columns based on settings
  const getGridStyle = () => {
    let cols = "30px 1fr 55px"; // #, Description, Qty
    if (includeUnits) cols += " 50px"; // Unit
    cols += " 80px"; // Price
    if (includeDiscount) cols += " 55px"; // Disc %
    if (includeVat) cols += " 55px"; // VAT %
    cols += " 90px"; // Amount
    return { gridTemplateColumns: cols };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="grid gap-2 items-end mb-2 text-[11px] text-[#878787]" style={getGridStyle()}>
        <span>#</span>
        <LabelInput name="template.descriptionLabel" className="truncate" />
        <LabelInput name="template.quantityLabel" className="truncate text-center" />
        {includeUnits && <span className="text-center">Unit</span>}
        <LabelInput name="template.priceLabel" className="truncate text-center" />
        {includeDiscount && <span className="text-center">Disc %</span>}
        {includeVat && <span className="text-center">VAT %</span>}
        <LabelInput name="template.totalLabel" className="text-right truncate" />
      </div>

      <Reorder.Group axis="y" values={fields} onReorder={reorderList} className="!m-0">
        {fields.map((field, index) => (
          <LineItemRow
            key={field.id}
            item={field}
            index={index}
            handleRemove={handleRemove}
            isReorderable={fields.length > 1}
            currency={currency || "EUR"}
            maximumFractionDigits={maximumFractionDigits}
            includeUnits={includeUnits}
            includeDiscount={includeDiscount}
            includeVat={includeVat}
            locale={locale || "sr-RS"}
            gridStyle={getGridStyle()}
          />
        ))}
      </Reorder.Group>

      <button
        type="button"
        onClick={() =>
          append({
            name: "",
            quantity: 0,
            price: 0,
            unit: "pcs",
            discount: 0,
            vat: 20,
          })
        }
        className="flex items-center space-x-2 text-[11px] text-[#878787] hover:text-foreground transition-colors"
      >
        <Plus className="size-4" />
        <span>Add item</span>
      </button>
    </div>
  );
}

function LineItemRow({
  index,
  handleRemove,
  isReorderable,
  item,
  currency,
  maximumFractionDigits,
  includeUnits,
  includeDiscount,
  includeVat,
  locale,
  gridStyle,
}: {
  index: number;
  handleRemove: (index: number) => void;
  isReorderable: boolean;
  item: any;
  currency: string;
  maximumFractionDigits: number;
  includeUnits?: boolean;
  includeDiscount?: boolean;
  includeVat?: boolean;
  locale: string;
  gridStyle: React.CSSProperties;
}) {
  const controls = useDragControls();
  const { control, watch, setValue, register } = useFormContext<FormValues>();

  const price = useWatch({
    control,
    name: `lineItems.${index}.price`,
  });

  const quantity = useWatch({
    control,
    name: `lineItems.${index}.quantity`,
  });

  const discount =
    useWatch({
      control,
      name: `lineItems.${index}.discount`,
    }) || 0;

  // VAT is handled via input field, watched for future calculations if needed
  useWatch({ control, name: `lineItems.${index}.vat` });

  const lineItemName = watch(`lineItems.${index}.name`);

  // Calculate amount with discount
  const baseAmount = calculateLineItemTotal({ price, quantity });
  const discountAmount = includeDiscount ? baseAmount * (discount / 100) : 0;
  const finalAmount = baseAmount - discountAmount;

  return (
    <Reorder.Item
      className="grid gap-2 items-center relative group mb-2 w-full"
      style={gridStyle}
      value={item}
      dragListener={false}
      dragControls={controls}
      onKeyDown={(e: React.KeyboardEvent<HTMLLIElement>) => {
        if (
          e.key === "ArrowDown" ||
          e.key === "ArrowUp" ||
          e.key === "Enter" ||
          e.key === "Escape"
        ) {
          e.stopPropagation();
        }
      }}
    >
      {isReorderable && (
        <Button
          type="button"
          className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-transparent cursor-grab"
          onPointerDown={(e) => controls.start(e)}
          variant="ghost"
          size="icon"
        >
          <GripVertical className="size-4 text-[#878787]" />
        </Button>
      )}

      {/* # Row number */}
      <span className="text-[#878787] text-xs">{index + 1}</span>

      {/* Description */}
      <ProductAutocomplete
        index={index}
        value={lineItemName || ""}
        onChange={(value: string) => {
          setValue(`lineItems.${index}.name`, value, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }}
      />

      {/* Qty */}
      <Controller
        name={`lineItems.${index}.quantity`}
        render={({ field }) => (
          <QuantityInput
            value={field.value ?? 0}
            onChange={field.onChange}
            onBlur={field.onBlur}
            className="text-center"
            min={0}
            step={1}
          />
        )}
      />

      {/* Unit */}
      {includeUnits && (
        <ProductAwareUnitInput
          name={`lineItems.${index}.unit`}
          lineItemIndex={index}
          placeholder="pcs"
        />
      )}

      {/* Price */}
      <ProductAwareAmountInput name={`lineItems.${index}.price`} lineItemIndex={index} />

      {/* Disc % */}
      {includeDiscount && (
        <input
          type="number"
          {...register(`lineItems.${index}.discount`, { valueAsNumber: true })}
          placeholder="0"
          className="p-0 border-0 h-6 bg-transparent border-b border-transparent focus:border-border outline-none text-center w-full text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}

      {/* VAT % */}
      {includeVat && (
        <input
          type="number"
          {...register(`lineItems.${index}.vat`, {
            valueAsNumber: true,
            setValueAs: (v) => {
              if (v === "" || v === null || v === undefined) return undefined;
              const num = typeof v === "number" ? v : Number(v);
              return Number.isNaN(num) ? undefined : num;
            },
          })}
          placeholder="20"
          className="p-0 border-0 h-6 bg-transparent border-b border-transparent focus:border-border outline-none text-center w-full text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}

      {/* Amount */}
      <div className="text-right">
        <span className="text-primary text-xs">
          {formatOrderAmount({
            amount: finalAmount,
            currency,
            locale,
            maximumFractionDigits,
          })}
        </span>
      </div>

      {index !== 0 && (
        <Button
          type="button"
          onClick={() => handleRemove(index)}
          className="absolute -right-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-transparent text-[#878787]"
          variant="ghost"
          size="icon"
        >
          <X className="size-4" />
        </Button>
      )}
    </Reorder.Item>
  );
}
