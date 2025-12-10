"use client";

import { Calendar, ChevronDown, Loader2, Plus, Save, Send } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FormValues } from "./form-context";

type SubmitButtonProps = {
  isSubmitting?: boolean;
  disabled?: boolean;
  isEditMode?: boolean;
};

export function SubmitButton({ isSubmitting, disabled, isEditMode }: SubmitButtonProps) {
  const { control, setValue } = useFormContext<FormValues>();
  const deliveryType = useWatch({ control, name: "template.deliveryType" });

  const options = isEditMode
    ? [
        { value: "create", label: "Update", icon: Save },
        { value: "create_and_send", label: "Update & send", icon: Send },
        { value: "scheduled", label: "Schedule", icon: Calendar },
      ]
    : [
        { value: "create", label: "Create", icon: Plus },
        { value: "create_and_send", label: "Create & send", icon: Send },
        { value: "scheduled", label: "Schedule", icon: Calendar },
      ];

  const currentOption = options.find((opt) => opt.value === deliveryType) || options[0];
  const Icon = currentOption.icon;

  return (
    <div className="flex items-center">
      <Button
        type="submit"
        size="sm"
        disabled={disabled || isSubmitting}
        className="rounded-r-none"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Icon className="h-4 w-4 mr-2" />
        )}
        {currentOption.label}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            className="rounded-l-none border-l border-l-white/20 px-2"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {options.map((option) => {
            const ItemIcon = option.icon;
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() =>
                  setValue(
                    "template.deliveryType",
                    option.value as FormValues["template"]["deliveryType"],
                    {
                      shouldDirty: true,
                    }
                  )
                }
              >
                <ItemIcon className="h-4 w-4 mr-2" />
                {option.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
