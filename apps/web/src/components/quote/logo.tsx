"use client";

import { useRef, useState, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { FormValues } from "./form-context";

const LOCAL_STORAGE_KEY_LOGO = "quote_logo_url";

export function Logo() {
  const { control, setValue } = useFormContext<FormValues>();
  const logoUrl = useWatch({ control, name: "template.logoUrl" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load logo from localStorage on mount
  useEffect(() => {
    const savedLogo = localStorage.getItem(LOCAL_STORAGE_KEY_LOGO);
    if (savedLogo && !logoUrl) {
      setValue("template.logoUrl", savedLogo, { shouldDirty: false });
      setValue("logoUrl", savedLogo, { shouldDirty: false });
    }
  }, [setValue, logoUrl]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    setIsLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;

        setValue("template.logoUrl", dataUrl, {
          shouldValidate: true,
          shouldDirty: true,
        });
        setValue("logoUrl", dataUrl, {
          shouldValidate: true,
          shouldDirty: true,
        });

        // Save to localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY_LOGO, dataUrl);

        setIsLoading(false);
        toast.success("Logo uploaded successfully");
      };
      reader.onerror = () => {
        setIsLoading(false);
        toast.error("Failed to upload logo");
      };
      reader.readAsDataURL(file);
    } catch {
      setIsLoading(false);
      toast.error("Something went wrong, please try again.");
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setValue("template.logoUrl", null, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("logoUrl", null, {
      shouldValidate: true,
      shouldDirty: true,
    });

    // Remove from localStorage
    localStorage.removeItem(LOCAL_STORAGE_KEY_LOGO);

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    toast.success("Logo removed");
  };

  return (
    <div className="relative h-[80px] group">
      <label htmlFor="logo-upload" className="block h-full cursor-pointer">
        {isLoading ? (
          <Skeleton className="w-[80px] h-full" />
        ) : logoUrl ? (
          <div className="max-w-[300px] h-full relative">
            <img
              src={logoUrl}
              alt="Quote logo"
              className="h-full w-auto object-contain"
            />
            <button
              type="button"
              className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex-col gap-1"
              onClick={handleRemove}
            >
              <X className="size-4" />
              <span className="text-xs font-medium">Remove</span>
            </button>
          </div>
        ) : (
          <div className="h-[80px] w-[80px] bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)] cursor-pointer" />
        )}
      </label>

      <input
        ref={inputRef}
        id="logo-upload"
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleUpload}
        disabled={isLoading}
      />
    </div>
  );
}

