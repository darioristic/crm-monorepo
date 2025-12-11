"use client";

import { ArrowUpDown } from "lucide-react";
import { useInboxParams } from "@/hooks/use-inbox-params";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function InboxOrdering() {
  const { params, setParams } = useInboxParams();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <ArrowUpDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={params.sort === "date" && params.order === "asc"}
          onCheckedChange={() => setParams({ sort: "date", order: "asc" })}
        >
          Most recent
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={params.sort === "date" && params.order === "desc"}
          onCheckedChange={() => setParams({ sort: "date", order: "desc" })}
        >
          Oldest first
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={params.sort === "name"}
          onCheckedChange={() =>
            setParams({ sort: "name", order: "asc" })
          }
        >
          Alphabetically
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
