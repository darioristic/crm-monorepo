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
import { UserFormSheet } from "./user-form-sheet";

export function CreateUserCard() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Card className="border-border/50 bg-muted/30">
				<CardHeader className="pb-4">
					<CardTitle className="text-base font-medium flex items-center gap-2">
						<Plus className="h-5 w-5" />
						Create New User
					</CardTitle>
					<CardDescription className="text-sm">
						Add a new user to your tenant.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground leading-relaxed">
						Create a new user account with appropriate role and permissions.
					</p>
				</CardContent>
				<CardFooter className="flex justify-end border-t pt-4">
					<Button onClick={() => setOpen(true)} className="gap-2">
						<Plus className="h-4 w-4" />
						Create User
					</Button>
				</CardFooter>
			</Card>
			<UserFormSheet open={open} onOpenChange={setOpen} />
		</>
	);
}

