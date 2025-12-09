"use client";

import { format, parseISO } from "date-fns";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { LabelInput } from "@/components/invoice/label-input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FormValues } from "./form-context";

const dateFormatMap: Record<string, string> = {
  "dd/MM/yyyy": "dd/MM/yyyy",
  "MM/dd/yyyy": "MM/dd/yyyy",
  "yyyy-MM-dd": "yyyy-MM-dd",
  "dd.MM.yyyy": "dd.MM.yyyy",
};

// Title Component
function DeliveryNoteTitle() {
  const { control } = useFormContext<FormValues>();

  return (
    <Controller
      control={control}
      name="template.title"
      render={({ field }) => (
        <Input
          {...field}
          value={field.value || "Delivery Note"}
          onChange={(e) => field.onChange(e.target.value)}
          className="!text-[29px] !font-semibold border-0 p-0 h-auto w-fit min-w-[180px] focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          placeholder="Delivery Note"
        />
      )}
    />
  );
}

// Delivery Number Component
function DeliveryNo() {
  const { control, formState } = useFormContext<FormValues>();
  const error = formState.errors.deliveryNumber;

  return (
    <div className="flex items-center gap-2">
      <LabelInput name="template.deliveryNoLabel" className="text-[11px] text-[#878787] w-[80px]" />
      <Controller
        control={control}
        name="deliveryNumber"
        render={({ field }) => (
          <Input
            {...field}
            className={`text-[11px] border-0 p-0 h-auto w-fit min-w-[100px] focus-visible:ring-0 focus-visible:ring-offset-0 font-mono bg-transparent ${
              error ? "text-red-500" : ""
            }`}
            placeholder="DN-001"
          />
        )}
      />
    </div>
  );
}

// Issue Date Component
function IssueDate() {
  const { control, setValue } = useFormContext<FormValues>();
  const dateFormat = useWatch({ control, name: "template.dateFormat" });

  const formatStr = dateFormatMap[dateFormat ?? "dd.MM.yyyy"] || "dd.MM.yyyy";

  return (
    <Controller
      control={control}
      name="issueDate"
      render={({ field }) => {
        const date = field.value ? parseISO(field.value) : new Date();

        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto p-0 text-[11px] font-mono font-normal hover:bg-transparent focus-visible:ring-0"
              >
                {format(date, formatStr)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => {
                  if (newDate) {
                    setValue("issueDate", newDate.toISOString(), {
                      shouldDirty: true,
                    });
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      }}
    />
  );
}

// Main Meta Component
export function DeliveryNoteMeta() {
  return (
    <div className="flex flex-col">
      <DeliveryNoteTitle />

      <div className="flex flex-col space-y-2 mt-3">
        <div className="flex items-center gap-2">
          <DeliveryNo />
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
