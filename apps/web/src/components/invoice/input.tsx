"use client";

import { cn } from "@/lib/utils";
import { Input as BaseInput } from "@/components/ui/input";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
}

export function Input({ className, name, ...props }: InputProps) {
  const { register, watch } = useFormContext();
  const [isFocused, setIsFocused] = useState(false);
  const fieldValue = watch(name);

  const { ref, ...rest } = register(name, {
    valueAsNumber: props.type === "number",
  });

  const isPlaceholder = !fieldValue && !isFocused;

  return (
    <div className="relative">
      <BaseInput
        {...props}
        {...rest}
        ref={ref}
        autoComplete="off"
        value={fieldValue || ""}
        className={cn(
          "border-0 p-0 h-6 border-b border-transparent focus:border-border text-xs focus-visible:ring-0",
          isPlaceholder && "opacity-0",
          className,
        )}
        onFocus={(evt) => {
          setIsFocused(true);
          props.onFocus?.(evt);
        }}
        onBlur={(evt) => {
          setIsFocused(false);
          props.onBlur?.(evt);
        }}
      />
      {isPlaceholder && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="h-full w-full bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]" />
        </div>
      )}
    </div>
  );
}

