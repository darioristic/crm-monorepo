"use client";

import { Button } from "@/components/ui/button";
import { LayoutGrid, History } from "lucide-react";
import { useEffect, useState } from "react";
import { useWidgetActions } from "./widget-provider";

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Morning";
  }
  if (hour >= 12 && hour < 17) {
    return "Afternoon";
  }

  return "Evening";
}

interface WidgetsHeaderProps {
  userName?: string;
}

export function WidgetsHeader({ userName = "Dario" }: WidgetsHeaderProps) {
  const { setIsCustomizing } = useWidgetActions();
  const [greeting, setGreeting] = useState(() => getTimeBasedGreeting());

  useEffect(() => {
    // Update greeting every 5 minutes
    const interval = setInterval(() => {
      setGreeting(getTimeBasedGreeting());
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex justify-between items-start mb-8">
      <div>
        <h1 className="text-[30px] font-serif leading-normal mb-1">
          <span>{greeting} </span>
          <span className="text-[#878787]">{userName},</span>
        </h1>
        <p className="text-[#878787] text-[14px]">
          here's a quick look at how things are going.
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex items-center gap-2 text-[#878787] border-[#1c1c1c] hover:bg-[#1c1c1c] hover:text-foreground"
          onClick={() => setIsCustomizing(true)}
        >
          <LayoutGrid className="size-4" />
          <span>Customize</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="text-[#878787] border-[#1c1c1c] hover:bg-[#1c1c1c] hover:text-foreground"
        >
          <History className="size-4" />
        </Button>
      </div>
    </div>
  );
}
