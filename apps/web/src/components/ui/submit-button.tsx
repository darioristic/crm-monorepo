"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  isSubmitting?: boolean;
};

export function SubmitButton({
  isSubmitting = false,
  disabled,
  children,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={disabled || isSubmitting} {...props}>
      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
