"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { UserForm } from "./user-form";
import type { TenantUser } from "@/lib/api";

type Props = {
	user?: TenantUser | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function UserFormSheet({ user, open, onOpenChange }: Props) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent>
				<SheetHeader className="mb-6 flex justify-between items-center flex-row">
					<h2 className="text-xl">{user ? "Edit User" : "Create User"}</h2>
					<Button
						size="icon"
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="p-0 m-0 size-auto hover:bg-transparent"
					>
						<X className="size-5" />
					</Button>
				</SheetHeader>

				<UserForm user={user || undefined} onSuccess={() => onOpenChange(false)} />
			</SheetContent>
		</Sheet>
	);
}

