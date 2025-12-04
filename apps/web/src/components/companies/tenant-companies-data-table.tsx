"use client";

import * as React from "react";
import {
	ColumnDef,
	ColumnFiltersState,
	SortingState,
	VisibilityState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowUpDown,
	Building2Icon,
	Columns,
	MoreHorizontal,
	RefreshCwIcon,
	Pencil,
	Trash2,
	AlertCircle,
} from "lucide-react";
import type { TenantCompany } from "@/lib/api";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { tenantAdminApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { toast } from "sonner";
import { useState } from "react";
import { CompanyFormSheet } from "./company-form-sheet";

export function TenantCompaniesDataTable() {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[]
	);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = React.useState({});
	const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
	const [companyToDelete, setCompanyToDelete] = React.useState<TenantCompany | null>(
		null
	);
	const [editCompany, setEditCompany] = React.useState<TenantCompany | null>(null);
	const queryClient = useQueryClient();

	const {
		data,
		isLoading,
		error,
		refetch,
	} = useQuery({
		queryKey: ["tenant-admin", "companies"],
		queryFn: async () => {
			const result = await tenantAdminApi.companies.getAll();
			if (!result.success) {
				throw new Error(result.error?.message || "Failed to load companies");
			}
			return result.data || [];
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			const result = await tenantAdminApi.companies.delete(id);
			if (!result.success) {
				throw new Error(result.error?.message || "Failed to delete company");
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["tenant-admin", "companies"] });
			toast.success("Company deleted successfully");
			setDeleteDialogOpen(false);
			setCompanyToDelete(null);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete company"
			);
		},
	});

	const handleEdit = (company: TenantCompany) => {
		setEditCompany(company);
	};

	const handleDelete = (company: TenantCompany) => {
		setCompanyToDelete(company);
		setDeleteDialogOpen(true);
	};

	const confirmDelete = async () => {
		if (!companyToDelete) return;
		deleteMutation.mutate(companyToDelete.id);
	};

	const columns: ColumnDef<TenantCompany>[] = [
		{
			id: "select",
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && "indeterminate")
					}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Select all"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Select row"
				/>
			),
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: "name",
			header: ({ column }) => {
				return (
					<Button
						className="-ml-3"
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Company Name
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => {
				return (
					<button
						type="button"
						className="flex items-center gap-4 hover:opacity-80 transition-opacity cursor-pointer text-left"
						onClick={() => handleEdit(row.original)}
					>
						<Avatar>
							<AvatarFallback>
								<Building2Icon className="h-4 w-4" />
							</AvatarFallback>
						</Avatar>
						<div className="font-medium hover:underline">{row.original.name}</div>
					</button>
				);
			},
		},
		{
			accessorKey: "industry",
			header: ({ column }) => {
				return (
					<Button
						className="-ml-3"
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Industry
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => (
				<Badge variant="outline" className="capitalize">
					{row.original.industry}
				</Badge>
			),
		},
		{
			accessorKey: "address",
			header: "Address",
			cell: ({ row }) => (
				<span className="text-muted-foreground max-w-[200px] truncate block">
					{row.original.address}
				</span>
			),
		},
		{
			accessorKey: "createdAt",
			header: "Created",
			cell: ({ row }) => {
				const d = new Date(row.original.createdAt);
				const day = d.getDate().toString().padStart(2, "0");
				const month = (d.getMonth() + 1).toString().padStart(2, "0");
				const year = d.getFullYear();
				return `${day}.${month}.${year}`;
			},
		},
		{
			id: "actions",
			enableHiding: false,
			cell: ({ row }) => {
				const company = row.original;
				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								<span className="sr-only">Open menu</span>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => handleEdit(company)}>
								<Pencil className="mr-2 h-4 w-4" />
								Edit Company
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive"
								onClick={() => handleDelete(company)}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
		},
	];

	const table = useReactTable({
		data: data || [],
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
	});

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="flex items-center gap-4">
					<Skeleton className="h-10 w-64" />
					<Skeleton className="h-10 w-24" />
				</div>
				<div className="rounded-md border">
					<Skeleton className="h-[400px] w-full" />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					Failed to load companies: {error instanceof Error ? error.message : "Unknown error"}
					<Button variant="link" onClick={() => refetch()} className="ml-2">
						Try again
					</Button>
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className="w-full">
			<div className="flex items-center gap-4 py-4">
				<Input
					placeholder="Search companies..."
					value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
					onChange={(event) =>
						table.getColumn("name")?.setFilterValue(event.target.value)
					}
					className="max-w-sm"
				/>
				<Button variant="outline" size="icon" onClick={() => refetch()}>
					<RefreshCwIcon className="h-4 w-4" />
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" className="ml-auto">
							<Columns className="mr-2 h-4 w-4" />
							Columns
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{table
							.getAllColumns()
							.filter((column) => column.getCanHide())
							.map((column) => {
								return (
									<DropdownMenuCheckboxItem
										key={column.id}
										className="capitalize"
										checked={column.getIsVisible()}
										onCheckedChange={(value) => column.toggleVisibility(value)}
									>
										{column.id}
									</DropdownMenuCheckboxItem>
								);
							})}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext()
													)}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No companies found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-between space-x-2 pt-4">
				<div className="text-muted-foreground flex-1 text-sm">
					{table.getFilteredSelectedRowModel().rows.length} of{" "}
					{table.getFilteredRowModel().rows.length} row(s) selected.
				</div>
			</div>

			<DeleteDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				title="Delete Company"
				description={`Are you sure you want to delete "${companyToDelete?.name}"? This action cannot be undone and may affect related users and records.`}
				onConfirm={confirmDelete}
				isLoading={deleteMutation.isPending}
			/>

			{editCompany && (
				<CompanyFormSheet
					company={editCompany}
					open={!!editCompany}
					onOpenChange={(open) => !open && setEditCompany(null)}
				/>
			)}
		</div>
	);
}

