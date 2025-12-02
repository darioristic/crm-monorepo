"use client";

import { useCompanyParams } from "@/hooks/use-company-params";
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

export function CreateCompanyCard() {
	const { setParams } = useCompanyParams();

	return (
		<Card className="border-border/50 bg-muted/30">
			<CardHeader className="pb-4">
				<CardTitle className="text-base font-medium flex items-center gap-2">
					<Plus className="h-5 w-5" />
					Create New Company
				</CardTitle>
				<CardDescription className="text-sm">
					Create a new organization to organize your work separately.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<p className="text-sm text-muted-foreground leading-relaxed">
					You will be automatically added as the owner and can switch between
					companies at any time from the company dropdown.
				</p>
			</CardContent>
			<CardFooter className="flex justify-end border-t pt-4">
				<Button
					onClick={() => setParams({ createCompany: true })}
					className="gap-2"
				>
					<Plus className="h-4 w-4" />
					Create Company
				</Button>
			</CardFooter>
		</Card>
	);
}

