"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CompanyFormSheet } from "./company-form-sheet";

export function CreateCompanyCardTenant() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Card className="border-border/50 bg-muted/30">
				<CardHeader className="pb-4">
					<CardTitle className="text-base font-medium flex items-center gap-2">
						<Plus className="h-5 w-5" />
						Create New Company
					</CardTitle>
					<CardDescription className="text-sm">
						Create a new company in your tenant.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground leading-relaxed">
						Add a new company to your tenant. Companies can be used to organize
						your work and manage different business entities.
					</p>
				</CardContent>
				<CardFooter className="flex justify-end border-t pt-4">
					<Button onClick={() => setOpen(true)} className="gap-2">
						<Plus className="h-4 w-4" />
						Create Company
					</Button>
				</CardFooter>
			</Card>
			<CompanyFormSheet open={open} onOpenChange={setOpen} />
		</>
	);
}

