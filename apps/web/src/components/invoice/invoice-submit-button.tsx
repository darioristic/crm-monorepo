"use client";

import { addDays, format, setHours, setMinutes } from "date-fns";
import { CalendarIcon, ChevronDown, Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type DeliveryType = "create" | "create_and_send" | "scheduled";

interface InvoiceSubmitButtonProps {
  mode: "create" | "edit";
  isLoading?: boolean;
  isScheduled?: boolean;
  currentScheduledAt?: string;
  onSubmit: (deliveryType: DeliveryType, scheduledAt?: string) => void;
  onCancelSchedule?: () => void;
}

export function InvoiceSubmitButton({
  mode,
  isLoading = false,
  isScheduled = false,
  currentScheduledAt,
  onSubmit,
  onCancelSchedule,
}: InvoiceSubmitButtonProps) {
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(
    isScheduled ? "scheduled" : "create"
  );
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(
    currentScheduledAt ? new Date(currentScheduledAt) : undefined
  );
  const [scheduleTime, setScheduleTime] = useState<string>(
    currentScheduledAt ? format(new Date(currentScheduledAt), "HH:mm") : getDefaultTime()
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Default schedule date is tomorrow
  useEffect(() => {
    if (!scheduleDate && deliveryType === "scheduled") {
      const tomorrow = addDays(new Date(), 1);
      setScheduleDate(tomorrow);
    }
  }, [deliveryType, scheduleDate]);

  function getDefaultTime(): string {
    const now = new Date();
    // Round up to next hour if minutes >= 30
    const roundedHour = now.getMinutes() >= 30 ? now.getHours() + 1 : now.getHours();
    return `${String(roundedHour % 24).padStart(2, "0")}:00`;
  }

  const getScheduledDateTime = (): string | undefined => {
    if (!scheduleDate || !scheduleTime) return undefined;

    const [hours, minutes] = scheduleTime.split(":").map(Number);
    const scheduledAt = setMinutes(setHours(scheduleDate, hours), minutes);
    return scheduledAt.toISOString();
  };

  const handleOptionChange = (value: DeliveryType) => {
    // If switching away from scheduled and there's an existing schedule, cancel it
    if (deliveryType === "scheduled" && value !== "scheduled" && isScheduled && onCancelSchedule) {
      onCancelSchedule();
    }
    setDeliveryType(value);
  };

  const handleSubmit = () => {
    if (deliveryType === "scheduled") {
      const scheduledAt = getScheduledDateTime();
      if (!scheduledAt) {
        // Set default if not set
        const tomorrow = addDays(new Date(), 1);
        const [hours, minutes] = scheduleTime.split(":").map(Number);
        const defaultSchedule = setMinutes(setHours(tomorrow, hours), minutes);
        onSubmit("scheduled", defaultSchedule.toISOString());
      } else {
        onSubmit("scheduled", scheduledAt);
      }
    } else {
      onSubmit(deliveryType);
    }
  };

  const getButtonLabel = (): string => {
    const actionVerb = mode === "create" ? "Create" : "Update";

    switch (deliveryType) {
      case "create":
        return actionVerb;
      case "create_and_send":
        return `${actionVerb} & Send`;
      case "scheduled":
        if (scheduleDate && scheduleTime) {
          return `Schedule (${format(scheduleDate, "MMM d")} ${scheduleTime})`;
        }
        return "Schedule";
      default:
        return actionVerb;
    }
  };

  return (
    <div className="flex">
      <Button type="button" onClick={handleSubmit} disabled={isLoading} className="rounded-r-none">
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {getButtonLabel()}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="default"
            className="rounded-l-none border-l border-primary-foreground/20 px-2"
            disabled={isLoading}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => handleOptionChange("create")}
            className={deliveryType === "create" ? "bg-accent" : ""}
          >
            {mode === "create" ? "Create" : "Update"}
            <span className="ml-auto text-xs text-muted-foreground">Save as draft</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => handleOptionChange("create_and_send")}
            className={deliveryType === "create_and_send" ? "bg-accent" : ""}
          >
            {mode === "create" ? "Create & Send" : "Update & Send"}
            <span className="ml-auto text-xs text-muted-foreground">Send now</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <div className="p-2">
            <div
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
                deliveryType === "scheduled" ? "bg-accent" : ""
              }`}
              onClick={() => handleOptionChange("scheduled")}
            >
              <CalendarIcon className="h-4 w-4" />
              <span>Schedule</span>
            </div>

            {deliveryType === "scheduled" && (
              <div className="mt-3 space-y-3">
                {/* Date Picker */}
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduleDate ? format(scheduleDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduleDate}
                      onSelect={(date) => {
                        setScheduleDate(date);
                        setIsCalendarOpen(false);
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {/* Time Picker */}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="flex-1"
                  />
                </div>

                {/* Cancel schedule option */}
                {isScheduled && onCancelSchedule && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => {
                      onCancelSchedule();
                      setDeliveryType("create");
                    }}
                  >
                    Cancel scheduled send
                  </Button>
                )}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
