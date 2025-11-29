"use client";

import { BadgeCheck, Bell, CreditCard, LogOut, Settings, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";

export default function UserMenu() {
	const { user, isAdmin, logout, getUserDisplayName, getUserInitials } = useAuth();

	if (!user) {
		return null;
	}

	const handleLogout = async () => {
		await logout();
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
					<Avatar className="cursor-pointer">
						<AvatarImage
							src={user.avatarUrl || `/images/avatars/01.png`}
							alt={getUserDisplayName()}
						/>
						<AvatarFallback className="rounded-lg">
							{getUserInitials()}
						</AvatarFallback>
					</Avatar>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-(--radix-dropdown-menu-trigger-width) min-w-60"
				align="end"
			>
				<DropdownMenuLabel className="p-0">
					<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
						<Avatar>
							<AvatarImage
								src={user.avatarUrl || `/images/avatars/01.png`}
								alt={getUserDisplayName()}
							/>
							<AvatarFallback className="rounded-lg">
								{getUserInitials()}
							</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="flex items-center gap-2 truncate font-semibold">
								{getUserDisplayName()}
								{isAdmin && (
									<Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
										<Shield className="mr-0.5 h-3 w-3" />
										Admin
									</Badge>
								)}
							</span>
							<span className="text-muted-foreground truncate text-xs">
								{user.email}
							</span>
						</div>
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<Link href="/dashboard/profile">
							<BadgeCheck />
							Profile
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/dashboard/settings">
							<Settings />
							Settings
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/dashboard/settings/notifications">
							<Bell />
							Notifications
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
				{isAdmin && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild>
								<Link href="/dashboard/users">
									<Shield />
									User Management
								</Link>
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
					<LogOut />
					Sign Out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
