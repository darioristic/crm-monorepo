"use client";

import { useFormContext, Controller, useWatch } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { FormValues } from "./form-context";

const dateFormatMap: Record<string, string> = {
  "dd/MM/yyyy": "dd/MM/yyyy",
  "MM/dd/yyyy": "MM/dd/yyyy",
  "yyyy-MM-dd": "yyyy-MM-dd",
  "dd.MM.yyyy": "dd.MM.yyyy",
};

export function DueDate() {
  const { control, setValue } = useFormContext<FormValues>();
  const dateFormat = useWatch({ control, name: "template.dateFormat" });

  const formatStr = dateFormatMap[dateFormat ?? "dd.MM.yyyy"] || "dd.MM.yyyy";

  return (
    <Controller
      control={control}
      name="dueDate"
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
                    setValue("dueDate", newDate.toISOString(), {
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
