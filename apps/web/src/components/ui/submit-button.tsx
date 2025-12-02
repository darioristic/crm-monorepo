"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ButtonProps } from "@/components/ui/button";

type SubmitButtonProps = ButtonProps & {
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

