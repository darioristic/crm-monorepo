import { UsersDataTable } from "@/components/users/users-data-table";
import { CreateUserCard } from "@/components/users/create-user-card";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Users",
	description: "Manage users in your tenant.",
};

export default function UsersPage() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold mb-1">Users</h2>
				<p className="text-sm text-muted-foreground">
					Manage users in your tenant. Create, edit, or delete user accounts.
				</p>
			</div>
			
			<div className="space-y-4">
				<CreateUserCard />
				<UsersDataTable />
			</div>
		</div>
	);
}

