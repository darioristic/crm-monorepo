"use client";

import { InviteTeamMembersModal } from "@/components/modals/invite-team-members-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Table } from "@tanstack/react-table";
import { useState } from "react";
import { Plus } from "lucide-react";

type TeamInvite = {
	id: string;
	email: string;
	role: "owner" | "member" | "admin";
	companyId: string;
};

type Props = {
	table?: Table<TeamInvite>;
};

export function DataTableHeader({ table }: Props) {
	const [isOpen, onOpenChange] = useState(false);

	return (
		<div className="flex items-center gap-4">
			<Input
				placeholder="Search invitations..."
				value={(table?.getColumn("email")?.getFilterValue() as string) ?? ""}
				onChange={(event) =>
					table?.getColumn("email")?.setFilterValue(event.target.value)
				}
				className="max-w-sm"
				autoComplete="off"
				autoCapitalize="none"
				autoCorrect="off"
				spellCheck="false"
			/>
			<div className="ml-auto">
				<Button onClick={() => onOpenChange(true)} className="gap-2">
					<Plus className="h-4 w-4" />
					Invite Member
				</Button>
				<InviteTeamMembersModal onOpenChange={onOpenChange} isOpen={isOpen} />
			</div>
		</div>
	);
}

