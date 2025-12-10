"use client";

import {
  Calendar,
  DollarSign,
  FileText,
  Hash,
  MoreVertical,
  Percent,
  QrCode,
  Receipt,
  Ruler,
} from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FormValues } from "./form-context";

const DATE_FORMATS = [
  { value: "dd.MM.yyyy", label: "31.12.2024" },
  { value: "dd/MM/yyyy", label: "31/12/2024" },
  { value: "MM/dd/yyyy", label: "12/31/2024" },
  { value: "yyyy-MM-dd", label: "2024-12-31" },
];

const QUOTE_SIZES = [
  { value: "a4", label: "A4" },
  { value: "letter", label: "Letter" },
];

const CURRENCIES = [
  { value: "EUR", label: "EUR - Euro" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "RSD", label: "RSD - Serbian Dinar" },
  { value: "CHF", label: "CHF - Swiss Franc" },
];

export function SettingsMenu() {
  const { control, setValue } = useFormContext<FormValues>();

  const dateFormat = useWatch({ control, name: "template.dateFormat" });
  const size = useWatch({ control, name: "template.size" });
  const currency = useWatch({ control, name: "template.currency" });
  const includeVat = useWatch({ control, name: "template.includeVat" });
  const includeTax = useWatch({ control, name: "template.includeTax" });
  const includeDiscount = useWatch({
    control,
    name: "template.includeDiscount",
  });
  const includeDecimals = useWatch({
    control,
    name: "template.includeDecimals",
  });
  const includeUnits = useWatch({ control, name: "template.includeUnits" });
  const includeQr = useWatch({ control, name: "template.includeQr" });
  const includePdf = useWatch({ control, name: "template.includePdf" });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>Quote Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Date Format */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Calendar className="mr-2 h-4 w-4" />
            Date Format
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {DATE_FORMATS.map((format) => (
              <DropdownMenuCheckboxItem
                key={format.value}
                checked={dateFormat === format.value}
                onCheckedChange={() =>
                  setValue("template.dateFormat", format.value as any, {
                    shouldDirty: true,
                  })
                }
              >
                {format.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Quote Size */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Ruler className="mr-2 h-4 w-4" />
            Quote Size
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {QUOTE_SIZES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.value}
                checked={size === s.value}
                onCheckedChange={() =>
                  setValue("template.size", s.value as any, {
                    shouldDirty: true,
                  })
                }
              >
                {s.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Currency */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <DollarSign className="mr-2 h-4 w-4" />
            Currency
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {CURRENCIES.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.value}
                checked={currency === c.value}
                onCheckedChange={() =>
                  setValue("template.currency", c.value, { shouldDirty: true })
                }
              >
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* VAT */}
        <DropdownMenuCheckboxItem
          checked={includeVat}
          onCheckedChange={(checked) =>
            setValue("template.includeVat", checked, { shouldDirty: true })
          }
        >
          <Receipt className="mr-2 h-4 w-4" />
          Include VAT
        </DropdownMenuCheckboxItem>

        {/* Tax */}
        <DropdownMenuCheckboxItem
          checked={includeTax}
          onCheckedChange={(checked) =>
            setValue("template.includeTax", checked, { shouldDirty: true })
          }
        >
          <Percent className="mr-2 h-4 w-4" />
          Include Tax
        </DropdownMenuCheckboxItem>

        {/* Discount */}
        <DropdownMenuCheckboxItem
          checked={includeDiscount}
          onCheckedChange={(checked) =>
            setValue("template.includeDiscount", checked, { shouldDirty: true })
          }
        >
          <Percent className="mr-2 h-4 w-4" />
          Include Discount
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Decimals */}
        <DropdownMenuCheckboxItem
          checked={includeDecimals}
          onCheckedChange={(checked) =>
            setValue("template.includeDecimals", checked, { shouldDirty: true })
          }
        >
          <Hash className="mr-2 h-4 w-4" />
          Show Decimals
        </DropdownMenuCheckboxItem>

        {/* Units */}
        <DropdownMenuCheckboxItem
          checked={includeUnits}
          onCheckedChange={(checked) =>
            setValue("template.includeUnits", checked, { shouldDirty: true })
          }
        >
          <Ruler className="mr-2 h-4 w-4" />
          Show Units
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* QR Code */}
        <DropdownMenuCheckboxItem
          checked={includeQr}
          onCheckedChange={(checked) =>
            setValue("template.includeQr", checked, { shouldDirty: true })
          }
        >
          <QrCode className="mr-2 h-4 w-4" />
          Include QR Code
        </DropdownMenuCheckboxItem>

        {/* PDF Attachment */}
        <DropdownMenuCheckboxItem
          checked={includePdf}
          onCheckedChange={(checked) =>
            setValue("template.includePdf", checked, { shouldDirty: true })
          }
        >
          <FileText className="mr-2 h-4 w-4" />
          Attach PDF
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
