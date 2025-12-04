"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronsUpDown, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { getCompanies, switchCompany, type Company } from "@/lib/companies";
import { SidebarMenuButton, useSidebar as useSidebarContext } from "@/components/ui/sidebar";
import { toast } from "sonner";

type Props = {
	isExpanded?: boolean;
};

export function CompanyDropdown({ isExpanded = false }: Props) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { user, refreshUser } = useAuth();
	const { state, isMobile } = useSidebarContext(); // Get both values at once
	const [mounted, setMounted] = useState(false);

	const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
	const [isActive, setActive] = useState(false);
	const [isChangingCompany, setIsChangingCompany] = useState(false);

	// Set mounted state after hydration
	useEffect(() => {
		setMounted(true);
	}, []);

	// Set selectedId after mount to avoid hydration mismatch
	useEffect(() => {
		if (user?.companyId) {
			setSelectedId(user.companyId);
		}
	}, [user?.companyId]);

	// Fetch companies - invalidate when user changes to get fresh list
	const { data: companiesResponse } = useQuery({
		queryKey: ["companies", user?.id],
		queryFn: async () => {
			const result = await getCompanies();
			if (!result.success || !result.data) {
				return [];
			}
			return result.data;
		},
		enabled: !!user,
		staleTime: 0, // Always fetch fresh data
	});

	// Company switching mutation
	const changeCompanyMutation = useMutation({
		mutationFn: async (companyId: string) => {
			console.log("🔄 Frontend: Switching to company:", companyId);
			const result = await switchCompany(companyId);
			
            if (!result.success) {
                const errorMessage = result.error?.message || 
                    result.error?.code || 
                    "Failed to switch company";

                const structuredError = !result.error || (typeof result.error === "object" && Object.keys(result.error).length === 0)
                    ? { code: "UNKNOWN", message: errorMessage }
                    : result.error;

                console.error("❌ Frontend: Switch failed:", {
                    error: structuredError,
                    message: errorMessage,
                });

                throw new Error(errorMessage);
            }
			
			console.log("✅ Frontend: Switch successful");
			return result;
		},
		onSuccess: async (result) => {
			console.log("✅ Frontend: Mutation success, refreshing...");
			
			// Update selectedId immediately with the new companyId
			if (result.data?.companyId) {
				setSelectedId(result.data.companyId);
			}
			
			// Refresh user data first to get new companyId
			await refreshUser();
			
			// Wait a bit for user state to update
			await new Promise(resolve => setTimeout(resolve, 50));
			
			// Invalidate all queries to refresh data
			await queryClient.invalidateQueries({ queryKey: ["companies"] });
			// Invalidate with both old and new user ID to cover all cases
			if (user?.id) {
				await queryClient.invalidateQueries({ queryKey: ["companies", user.id] });
			}
			if (result.data?.id) {
				await queryClient.invalidateQueries({ queryKey: ["companies", result.data.id] });
			}
			// Invalidate team/company queries used in Settings page
			await queryClient.invalidateQueries({ queryKey: ["team", "current"] });
			await queryClient.invalidateQueries({ queryKey: ["company", "current"] });
			
			// Invalidate all company-dependent data queries
			await queryClient.invalidateQueries({ queryKey: ["documents"] });
			await queryClient.invalidateQueries({ queryKey: ["invoices"] });
			await queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
			await queryClient.invalidateQueries({ queryKey: ["orders"] });
			await queryClient.invalidateQueries({ queryKey: ["quotes"] });
			await queryClient.invalidateQueries({ queryKey: ["contacts"] });
			await queryClient.invalidateQueries({ queryKey: ["products"] });
			await queryClient.invalidateQueries({ queryKey: ["payments"] });
			
			// Refetch all data immediately
			await Promise.all([
				queryClient.refetchQueries({ queryKey: ["team", "current"] }),
				queryClient.refetchQueries({ queryKey: ["companies"] }),
			]);
			
			setIsChangingCompany(false);
			console.log("✅ Frontend: All data refreshed");
			
			// Show success toast
			toast.success("Company switched successfully");
			
			// Refresh server components
			router.refresh();
		},
		onError: (error) => {
			console.error("❌ Frontend: Mutation error:", error);
			setIsChangingCompany(false);
			toast.error(error instanceof Error ? error.message : "Failed to switch company");
		},
	});

	useEffect(() => {
		if (user?.companyId) {
			setSelectedId(user.companyId);
		}
	}, [user?.companyId]);

	// Sort companies - selected first
	const sortedCompanies =
		companiesResponse?.sort((a, b) => {
			if (a.id === selectedId) return -1;
			if (b.id === selectedId) return 1;
			return (a.name ?? "").localeCompare(b.name ?? "");
		}) ?? [];

	const handleCompanyChange = (companyId: string) => {
		if (companyId === selectedId) {
			setActive(false);
			return;
		}

		setIsChangingCompany(true);
		setSelectedId(companyId);
		setActive(false);

		changeCompanyMutation.mutate(companyId);
	};

	// Don't render until mounted to avoid hydration mismatch
	if (!mounted || !user) {
		return (
			<SidebarMenuButton className="hover:text-foreground h-10 group-data-[collapsible=icon]:px-0! hover:bg-[var(--primary)]/5">
				<div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
				{isExpanded && <div className="h-4 w-24 bg-muted animate-pulse rounded" />}
			</SidebarMenuButton>
		);
	}

	const selectedCompany = sortedCompanies.find((c) => c.id === selectedId) || sortedCompanies[0];
	const isExpandedState = state === "expanded" || isExpanded;

	// If no companies, show empty state with option to create
	if (sortedCompanies.length === 0) {
		return (
			<DropdownMenu open={isActive} onOpenChange={setActive}>
				<DropdownMenuTrigger asChild>
					<SidebarMenuButton className="hover:text-foreground h-10 group-data-[collapsible=icon]:px-0! hover:bg-[var(--primary)]/5">
						<Avatar className="h-8 w-8 rounded-lg">
							<AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold rounded-lg">
								<Plus className="h-4 w-4" />
							</AvatarFallback>
						</Avatar>
						{isExpandedState && (
							<span className="font-semibold truncate text-muted-foreground">No Company</span>
						)}
						<ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
					</SidebarMenuButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					className="mt-4 w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
					side={isMobile ? "bottom" : "right"}
					align="end"
					sideOffset={4}
				>
					<DropdownMenuLabel>Companies</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<div className="px-2 py-4 text-center text-sm text-muted-foreground">
						No companies available
					</div>
					<DropdownMenuSeparator />
					<Button className="w-full" asChild>
						<Link href="/dashboard/companies/create" onClick={() => setActive(false)}>
							<Plus className="mr-2 h-4 w-4" />
							Create Company
						</Link>
					</Button>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	}

	if (!selectedCompany) {
		return (
			<SidebarMenuButton className="hover:text-foreground h-10 group-data-[collapsible=icon]:px-0! hover:bg-[var(--primary)]/5">
				<div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
				{isExpandedState && <div className="h-4 w-24 bg-muted animate-pulse rounded" />}
			</SidebarMenuButton>
		);
	}

	return (
		<DropdownMenu open={isActive} onOpenChange={setActive}>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton className="hover:text-foreground h-10 group-data-[collapsible=icon]:px-0! hover:bg-[var(--primary)]/5">
					<Avatar className="h-8 w-8 rounded-lg">
						{selectedCompany.logoUrl ? (
							<AvatarImage
								src={selectedCompany.logoUrl}
								alt={selectedCompany.name}
								className="rounded-lg"
							/>
						) : null}
						<AvatarFallback className="bg-black text-white text-xs font-semibold rounded-lg">
							{selectedCompany.name?.charAt(0)?.toUpperCase()}
							{selectedCompany.name?.charAt(1)?.toUpperCase()}
						</AvatarFallback>
					</Avatar>
					{isExpandedState && (
						<span className="font-semibold truncate">{selectedCompany.name}</span>
					)}
					<ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="mt-4 w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
				side={isMobile ? "bottom" : "right"}
				align="end"
				sideOffset={4}
			>
				<DropdownMenuLabel>Companies</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{sortedCompanies.map((company) => (
					<DropdownMenuItem
						key={company.id}
						className="flex items-center gap-3"
						onClick={() => handleCompanyChange(company.id)}
						disabled={isChangingCompany}
					>
						<Avatar className="h-8 w-8 rounded-lg">
							{company.logoUrl ? (
								<AvatarImage
									src={company.logoUrl}
									alt={company.name}
									className="rounded-lg"
								/>
							) : null}
							<AvatarFallback className="bg-black text-white text-xs font-semibold rounded-lg">
								{company.name?.charAt(0)?.toUpperCase()}
								{company.name?.charAt(1)?.toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className="flex flex-col flex-1">
							<span className="text-sm font-medium">{company.name}</span>
							{company.role && (
								<span className="text-xs text-muted-foreground capitalize">{company.role}</span>
							)}
						</div>
						{company.id === selectedId && (
							<div className="h-2 w-2 rounded-full bg-primary" />
						)}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<Button className="w-full" asChild>
					<Link href="/dashboard/companies/create" onClick={() => setActive(false)}>
						<Plus className="mr-2 h-4 w-4" />
						New Company
					</Link>
				</Button>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
