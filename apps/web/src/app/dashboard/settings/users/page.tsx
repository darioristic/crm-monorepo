import type { Metadata } from "next";
import { TeamMembers } from "@/components/team-members";

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
          View and manage members of your current company.
        </p>
      </div>

      <TeamMembers />
    </div>
  );
}
