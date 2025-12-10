"use client";

import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  required?: boolean;
  className?: string;
  onSave?: (value: string) => void;
};

export function LabelInput({ name, className, onSave }: Props) {
  const { setValue, watch } = useFormContext();
  const value = watch(name);

  return (
    <input
      id={name}
      name={name}
      type="text"
      aria-label={name}
      className={cn("text-[11px] text-[#878787] min-w-10 outline-none bg-transparent", className)}
      defaultValue={value}
      onBlur={(e) => {
        const newValue = e.currentTarget.value || "";
        setValue(name, newValue, { shouldValidate: true, shouldDirty: true });
        if (newValue !== value) {
          onSave?.(newValue);
        }
      }}
    />
  );
}
