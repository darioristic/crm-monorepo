"use client";

import type { CompanyMember } from "@/lib/companies";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { deleteCompanyMember, updateCompanyMember, leaveCompany } from "@/lib/companies";
import { useUserQuery } from "@/hooks/use-user";
import type { Table } from "@tanstack/react-table";

type TeamMember = CompanyMember & {
	id: string;
	companyId: string;
};

type Props = {
	member: TeamMember;
	table: Table<TeamMember>;
};

export function MemberActions({ member, table }: Props) {
	const { data: user } = useUserQuery();
	const queryClient = useQueryClient();
	const router = useRouter();

	const deleteMemberMutation = useMutation({
		mutationFn: async ({ companyId, userId }: { companyId: string; userId: string }) => {
			const result = await deleteCompanyMember(companyId, userId);
			if (!result.success) {
				throw new Error(result.error?.message || "Failed to delete member");
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["company", "members"] });
			toast.success("Member removed successfully");
		},
		onError: () => {
			toast.error("Error deleting member");
		},
	});

	const leaveTeamMutation = useMutation({
		mutationFn: async (companyId: string) => {
			const result = await leaveCompany(companyId);
			if (!result.success) {
				throw new Error(result.error?.message || "Failed to leave team");
			}
			return result;
		},
		onSuccess: async () => {
			queryClient.invalidateQueries();
			router.push("/dashboard/companies");
		},
		onError: () => {
			toast.error("Failed to leave team");
		},
	});

	const updateMemberMutation = useMutation({
		mutationFn: async ({ companyId, userId, role }: { companyId: string; userId: string; role: "owner" | "member" | "admin" }) => {
			const result = await updateCompanyMember(companyId, userId, role);
			if (!result.success) {
				throw new Error(result.error?.message || "Failed to update member");
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["company", "members"] });
			toast.success("Member role updated");
		},
		onError: () => {
			toast.error("Failed to update member role");
		},
	});

	// Get current user and company info
	const isCurrentUser = user?.id === member.id;
	
	// Get total owners count from table meta
	const meta = table.options.meta as { totalOwners?: number; currentUser?: TeamMember } | undefined;
	const totalOwners = meta?.totalOwners ?? 0;
	const currentUserMember = meta?.currentUser;
	const isCurrentUserOwner = currentUserMember?.role === "owner";
	const canChangeRole = isCurrentUserOwner && (isCurrentUser ? totalOwners > 1 : true);
	const canManage = isCurrentUserOwner;

	return (
		<div className="flex justify-end">
			<div className="flex space-x-2 items-center">
				{canChangeRole && !isCurrentUser ? (
					<Select
						value={member.role ?? undefined}
						onValueChange={(role) => {
							updateMemberMutation.mutate({
								companyId: member.companyId,
								userId: member.id,
								role: role as "owner" | "member" | "admin",
							});
						}}
					>
						<SelectTrigger>
							<SelectValue
								placeholder={member.role || "member"}
							/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="owner">Owner</SelectItem>
							<SelectItem value="member">Member</SelectItem>
							<SelectItem value="admin">Admin</SelectItem>
						</SelectContent>
					</Select>
				) : (
					<span className="text-sm text-[#606060]">
						{member.role || "member"}
					</span>
				)}
				{canManage && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 p-0">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{!isCurrentUser && (
								<AlertDialog>
									<DropdownMenuItem
										className="text-destructive"
										onSelect={(e) => e.preventDefault()}
									>
										<AlertDialogTrigger>Remove Member</AlertDialogTrigger>
									</DropdownMenuItem>

									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Remove Team Member
											</AlertDialogTitle>
											<AlertDialogDescription>
												You are about to remove the following Team Member,
												are you sure you want to continue?
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												disabled={deleteMemberMutation.isPending}
												onClick={() => {
													deleteMemberMutation.mutate({
														companyId: member.companyId,
														userId: member.id,
													});
												}}
											>
												{deleteMemberMutation.isPending ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													"Confirm"
												)}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							)}

							{isCurrentUser && (
								<AlertDialog>
									<DropdownMenuItem
										className="text-destructive"
										onSelect={(e) => e.preventDefault()}
									>
										<AlertDialogTrigger>Leave Team</AlertDialogTrigger>
									</DropdownMenuItem>

									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Leave Team</AlertDialogTitle>
											<AlertDialogDescription>
												You are about to leave this team. In order to regain
												access at a later time, a Team Owner must invite
												you.
												<p className="mt-4">
													Are you sure you want to continue?
												</p>
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												disabled={leaveTeamMutation.isPending}
												onClick={() =>
													leaveTeamMutation.mutate(member.companyId)
												}
											>
												{leaveTeamMutation.isPending ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													"Confirm"
												)}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</div>
	);
}

