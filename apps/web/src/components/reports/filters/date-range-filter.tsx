"use client";

import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DatePreset } from "./use-report-filters";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

interface DateRangeFilterProps {
  from: string;
  to: string;
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  onCustomRangeChange: (from: Date, to: Date) => void;
  className?: string;
}

const presetOptions = [
  { value: "today", label: "Today" },
  { value: "last7Days", label: "Last 7 Days" },
  { value: "last30Days", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "last90Days", label: "Last 90 Days" },
  { value: "thisYear", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

export function DateRangeFilter({
  from,
  to,
  preset,
  onPresetChange,
  onCustomRangeChange,
  className,
}: DateRangeFilterProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  const dateRange: DateRange = {
    from: new Date(from),
    to: new Date(to),
  };

  const handlePresetChange = (value: string) => {
    if (value === "custom") {
      setIsCalendarOpen(true);
    } else {
      onPresetChange(value as DatePreset);
    }
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onCustomRangeChange(range.from, range.to);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "MMM d, yyyy")} -{" "}
                  {format(dateRange.to, "MMM d, yyyy")}
                </>
              ) : (
                format(dateRange.from, "MMM d, yyyy")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleDateSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

