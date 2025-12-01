"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Company = {
  id: string;
  name: string;
  email?: string | null;
};

type Props = {
  companies: Company[];
  onSelect: (customerId: string) => void;
};

export function SelectCustomer({ companies, onSelect }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const formatData = companies?.map((item) => ({
    value: item.name,
    label: item.name,
    id: item.id,
    email: item.email,
  }));

  const handleSelect = (id: string) => {
    if (id === "create-customer") {
      // Navigate to create company page
      router.push("/dashboard/companies?create=true");
    } else {
      onSelect(id);
    }
    setOpen(false);
  };

  if (!companies?.length) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => router.push("/dashboard/companies?create=true")}
        className="text-[#434343] dark:text-[#878787] p-0 text-[11px] h-auto hover:bg-transparent"
      >
        Select customer
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={open}
          className="text-[#434343] dark:text-[#878787] p-0 text-[11px] h-auto hover:bg-transparent"
        >
          Select customer
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[250px] p-0"
        side="bottom"
        sideOffset={10}
        align="start"
      >
        <Command>
          <CommandInput
            value={value}
            onValueChange={setValue}
            placeholder="Search customer..."
            className="h-9 text-xs"
          />
          <CommandList className="max-h-[200px] overflow-auto">
            <CommandEmpty className="text-xs border-t border-border p-2">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/companies?create=true&name=${encodeURIComponent(value)}`)}
                className="text-primary hover:underline"
              >
                Create "{value}"
              </button>
            </CommandEmpty>
            <CommandGroup>
              {formatData?.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.value}
                  onSelect={() => handleSelect(item.id)}
                  className="group text-xs cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.email && (
                      <span className="text-[10px] text-muted-foreground">
                        {item.email}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/companies/${item.id}`);
                    }}
                    className="ml-auto text-xs opacity-0 group-hover:opacity-50 hover:!opacity-100"
                  >
                    Edit
                  </button>
                </CommandItem>
              ))}
              <CommandItem
                value="create-customer"
                onSelect={() => handleSelect("create-customer")}
                className="text-xs border-t border-border pt-2 mt-2 cursor-pointer"
              >
                + Create new customer
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
