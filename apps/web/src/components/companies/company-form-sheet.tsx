"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { TenantCompanyForm } from "./tenant-company-form";
import type { TenantCompany } from "@/lib/api";

type Props = {
	company?: TenantCompany | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function CompanyFormSheet({ company, open, onOpenChange }: Props) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent>
				<SheetHeader className="mb-6 flex justify-between items-center flex-row">
					<h2 className="text-xl">{company ? "Edit Company" : "Create Company"}</h2>
					<Button
						size="icon"
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="p-0 m-0 size-auto hover:bg-transparent"
					>
						<X className="size-5" />
					</Button>
				</SheetHeader>

				<TenantCompanyForm company={company || undefined} onSuccess={() => onOpenChange(false)} />
			</SheetContent>
		</Sheet>
	);
}

