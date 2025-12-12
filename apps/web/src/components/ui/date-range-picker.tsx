"use client";

import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type DateRangePickerProps = {
  range?: DateRange;
  className?: string;
  onSelect: (range?: DateRange) => void;
  placeholder?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  numberOfMonths?: number;
};

export function DateRangePicker({
  className,
  range,
  disabled,
  onSelect,
  placeholder = "Select date range",
  align = "end",
  numberOfMonths = 2,
}: DateRangePickerProps) {
  const formatDateRange = () => {
    if (!range?.from) return placeholder;
    if (!range.to) return format(range.from, "LLL dd, y");
    return `${format(range.from, "LLL dd, y")} - ${format(range.to, "LLL dd, y")}`;
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild disabled={disabled}>
          <Button
            variant="outline"
            className={cn("justify-start text-left font-medium", !range && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="flex-1">{formatDateRange()}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={range?.from}
            selected={range}
            onSelect={onSelect}
            numberOfMonths={numberOfMonths}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
