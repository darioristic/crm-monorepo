import { TeamMembers } from "@/components/team-members";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Members",
	description: "Manage team members and invitations for your company.",
};

export default function MembersPage() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold mb-1">Team Members</h2>
				<p className="text-sm text-muted-foreground">
					Manage who has access to your company and their roles.
				</p>
			</div>
			<TeamMembers />
		</div>
	);
}

