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
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import { X } from "lucide-react";
import { useState } from "react";
import { CreateCompanyInlineForm } from "./create-company-inline-form";

type Company = {
  id: string;
  name: string;
  email?: string | null;
};

type Props = {
  companies: Company[];
  onSelect: (customerId: string) => void;
  onCompanyCreated?: () => void;
};

export function SelectCustomer({ companies, onSelect, onCompanyCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [prefillName, setPrefillName] = useState("");

  const formatData = companies?.map((item) => ({
    value: item.name,
    label: item.name,
    id: item.id,
    email: item.email,
  }));

  const handleSelect = (id: string) => {
    if (id === "create-customer") {
      setPrefillName("");
      setShowCreateSheet(true);
    } else {
      onSelect(id);
    }
    setOpen(false);
  };

  const handleCreateWithName = (name: string) => {
    setPrefillName(name);
    setShowCreateSheet(true);
    setOpen(false);
  };

  const handleCompanyCreated = (newCompanyId: string) => {
    setShowCreateSheet(false);
    setPrefillName("");
    onSelect(newCompanyId);
    onCompanyCreated?.();
  };

  if (!companies?.length) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowCreateSheet(true)}
          className="text-[#434343] dark:text-[#878787] p-0 text-[11px] h-auto hover:bg-transparent"
        >
          Select customer
        </Button>

        <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
          <SheetContent className="sm:max-w-[480px]">
            <SheetHeader className="mb-6 flex justify-between items-center flex-row">
              <h2 className="text-xl">Create Customer</h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowCreateSheet(false)}
                className="p-0 m-0 size-auto hover:bg-transparent"
              >
                <X className="size-5" />
              </Button>
            </SheetHeader>
            <CreateCompanyInlineForm
              prefillName={prefillName}
              onSuccess={handleCompanyCreated}
              onCancel={() => setShowCreateSheet(false)}
            />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
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
                  onClick={() => handleCreateWithName(value)}
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

      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent className="sm:max-w-[480px]">
          <SheetHeader className="mb-6 flex justify-between items-center flex-row">
            <h2 className="text-xl">Create Customer</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowCreateSheet(false)}
              className="p-0 m-0 size-auto hover:bg-transparent"
            >
              <X className="size-5" />
            </Button>
          </SheetHeader>
          <CreateCompanyInlineForm
            prefillName={prefillName}
            onSuccess={handleCompanyCreated}
            onCancel={() => setShowCreateSheet(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
