"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export interface PricingLineItem {
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface DeliveryLineItem {
  productName: string;
  description?: string;
  quantity: number;
  unit: string;
}

export type LineItem = PricingLineItem | DeliveryLineItem;

type LineItemsEditorVariant = "quote" | "invoice" | "delivery";

interface LineItemsEditorProps<T extends LineItem> {
  items: T[];
  onChange: (items: T[]) => void;
  variant: LineItemsEditorVariant;
  disabled?: boolean;
  errors?: Record<number, Record<string, string>>;
}

const UNIT_OPTIONS = ["pcs", "kg", "g", "l", "ml", "m", "cm", "box", "pack", "set"];

function isPricingItem(item: LineItem): item is PricingLineItem {
  return "unitPrice" in item;
}

export function LineItemsEditor<T extends LineItem>({
  items,
  onChange,
  variant,
  disabled = false,
  errors = {},
}: LineItemsEditorProps<T>) {
  const showPricing = variant === "quote" || variant === "invoice";
  const showUnit = variant === "delivery";

  const getDefaultItem = useCallback((): T => {
    if (showPricing) {
      return {
        productName: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
      } as T;
    }
    return {
      productName: "",
      description: "",
      quantity: 1,
      unit: "pcs",
    } as T;
  }, [showPricing]);

  const handleAddItem = () => {
    onChange([...items, getDefaultItem()]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof T, value: string | number) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      return { ...item, [field]: value };
    });
    onChange(updated);
  };

  const calculateLineTotal = (item: LineItem): number => {
    if (!isPricingItem(item)) return 0;
    const lineTotal = item.quantity * item.unitPrice;
    const discountAmount = lineTotal * (item.discount / 100);
    return lineTotal - discountAmount;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {variant === "delivery" ? "Items to Deliver" : "Line Items"}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          disabled={disabled}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {items.map((item, index) => (
        <Card key={index} className="p-4">
          <div className="grid gap-4 sm:grid-cols-12">
            {/* Product Name */}
            <div className={showPricing ? "sm:col-span-4" : "sm:col-span-5"}>
              <Label className="text-sm font-medium">Product/Service *</Label>
              <Input
                placeholder="Product name"
                value={item.productName}
                onChange={(e) => handleItemChange(index, "productName" as keyof T, e.target.value)}
                disabled={disabled}
                className={errors[index]?.productName ? "border-destructive" : ""}
              />
              {errors[index]?.productName && (
                <p className="text-xs text-destructive mt-1">{errors[index].productName}</p>
              )}
            </div>

            {/* Quantity */}
            <div className={showPricing ? "sm:col-span-2" : "sm:col-span-3"}>
              <Label className="text-sm font-medium">Qty *</Label>
              <Input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => handleItemChange(index, "quantity" as keyof T, Number(e.target.value))}
                disabled={disabled}
                className={errors[index]?.quantity ? "border-destructive" : ""}
              />
              {errors[index]?.quantity && (
                <p className="text-xs text-destructive mt-1">{errors[index].quantity}</p>
              )}
            </div>

            {/* Unit Price (for quotes/invoices) */}
            {showPricing && isPricingItem(item) && (
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium">Unit Price *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => handleItemChange(index, "unitPrice" as keyof T, Number(e.target.value))}
                  disabled={disabled}
                  className={errors[index]?.unitPrice ? "border-destructive" : ""}
                />
                {errors[index]?.unitPrice && (
                  <p className="text-xs text-destructive mt-1">{errors[index].unitPrice}</p>
                )}
              </div>
            )}

            {/* Discount (for quotes/invoices) */}
            {showPricing && isPricingItem(item) && (
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium">Discount %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={item.discount}
                  onChange={(e) => handleItemChange(index, "discount" as keyof T, Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            )}

            {/* Unit (for delivery) */}
            {showUnit && !isPricingItem(item) && (
              <div className="sm:col-span-3">
                <Label className="text-sm font-medium">Unit *</Label>
                <Select
                  value={(item as DeliveryLineItem).unit}
                  onValueChange={(value) => handleItemChange(index, "unit" as keyof T, value)}
                  disabled={disabled}
                >
                  <SelectTrigger className={errors[index]?.unit ? "border-destructive" : ""}>
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors[index]?.unit && (
                  <p className="text-xs text-destructive mt-1">{errors[index].unit}</p>
                )}
              </div>
            )}

            {/* Line Total (for quotes/invoices) */}
            {showPricing && (
              <div className="sm:col-span-1 flex items-end">
                <div className="text-sm font-medium mb-2">
                  {formatCurrency(calculateLineTotal(item))}
                </div>
              </div>
            )}

            {/* Delete Button */}
            <div className="sm:col-span-1 flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveItem(index)}
                disabled={items.length === 1 || disabled}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="mt-2">
            <Input
              placeholder="Description (optional)"
              value={item.description || ""}
              onChange={(e) => handleItemChange(index, "description" as keyof T, e.target.value)}
              disabled={disabled}
            />
          </div>
        </Card>
      ))}

      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
          No items added. Click "Add Item" to start.
        </div>
      )}
    </div>
  );
}

