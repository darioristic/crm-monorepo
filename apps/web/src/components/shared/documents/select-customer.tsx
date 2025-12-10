"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CreateCompanyInlineForm } from "@/components/shared/documents/create-company-inline-form";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { accountsApi, contactsApi } from "@/lib/api";

type Company = {
  id: string;
  name: string;
  email?: string | null;
};

type Props = {
  companies: Company[];
  onSelect: (type: "individual" | "organization", id: string) => void;
  onCompanyCreated?: () => void;
};

export function SelectCustomer({ companies, onSelect, onCompanyCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [prefillName, setPrefillName] = useState("");
  // Always search across all types
  const [results, setResults] = useState<
    Array<{
      type: "individual" | "organization";
      id: string;
      display: string;
      subtitle?: string;
      favorite: boolean;
    }>
  >([]);
  const [_isLoading, setIsLoading] = useState(false);

  const individualSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    jmbg: z.string().min(6).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  });
  const individualForm = useForm<z.infer<typeof individualSchema>>({
    resolver: zodResolver(individualSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      jmbg: "",
      email: "",
      phone: "",
    },
  });

  const formatData = results?.map((item) => ({
    value: item.display,
    label: item.display,
    id: item.id,
    email: item.subtitle,
    type: item.type,
    favorite: item.favorite,
  }));

  const handleSelect = (id: string, type?: "individual" | "organization") => {
    if (id === "create-customer") {
      setPrefillName("");
      setShowCreateSheet(true);
    } else {
      if (type) {
        accountsApi.select({ type, id }).catch(() => {});
        onSelect(type, id);
      }
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
    onSelect("organization", newCompanyId);
    onCompanyCreated?.();
  };

  const runSearch = async (q: string, t: "all" | "individual" | "organization") => {
    setIsLoading(true);
    try {
      const typeParam = t === "all" ? undefined : t;
      const res = await accountsApi.search({ q, type: typeParam, limit: 20 });
      if (res.success && res.data) {
        setResults(res.data);
      } else {
        setResults([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleValueChange = (v: string) => {
    setValue(v);
    runSearch(v, "all");
  };

  useEffect(() => {
    if (open) {
      runSearch("", "all");
    }
  }, [open]);

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

        <PopoverContent className="w-[250px] p-0" side="bottom" sideOffset={10} align="start">
          <Command>
            <CommandInput
              value={value}
              onValueChange={handleValueChange}
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
                    onSelect={() => handleSelect(item.id, item.type)}
                    className="group text-xs cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                      {item.email && (
                        <span className="text-[10px] text-muted-foreground">{item.email}</span>
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
          <div className="space-y-6">
            <CreateCompanyInlineForm
              prefillName={prefillName}
              onSuccess={handleCompanyCreated}
              onCancel={() => setShowCreateSheet(false)}
            />
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium mb-3">Create Individual</h3>
              <Form {...individualForm}>
                <form
                  onSubmit={individualForm.handleSubmit(async (data) => {
                    const res = await contactsApi.create({
                      firstName: data.firstName,
                      lastName: data.lastName,
                      email: data.email || "",
                      phone: data.phone,
                      company: undefined,
                      position: undefined,
                      address: undefined,
                      notes: undefined,
                      leadId: undefined,
                      jmbg: data.jmbg,
                    });
                    if (res.success && res.data) {
                      setShowCreateSheet(false);
                      onSelect("individual", res.data.id);
                    }
                  })}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={individualForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">First Name</FormLabel>
                          <FormControl>
                            <InputGroup>
                              <InputGroupInput {...field} />
                            </InputGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={individualForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Last Name</FormLabel>
                          <FormControl>
                            <InputGroup>
                              <InputGroupInput {...field} />
                            </InputGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={individualForm.control}
                    name="jmbg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">JMBG</FormLabel>
                        <FormControl>
                          <InputGroup>
                            <InputGroupInput {...field} />
                          </InputGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={individualForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Email</FormLabel>
                          <FormControl>
                            <InputGroup>
                              <InputGroupInput type="email" {...field} />
                            </InputGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={individualForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Phone</FormLabel>
                          <FormControl>
                            <InputGroup>
                              <InputGroupInput {...field} />
                            </InputGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="sticky bottom-0 bg-background pt-4 border-t flex justify-end gap-2 [padding-bottom:env(safe-area-inset-bottom)]">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateSheet(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create & Select</Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
