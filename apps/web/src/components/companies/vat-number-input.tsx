"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

interface VatNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function VatNumberInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Enter VAT number",
  ...props
}: VatNumberInputProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    onChange(newValue);
  };

  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      autoComplete="off"
      {...props}
    />
  );
}

