"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { DocumentWithTags } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { FileText, FileImage, FileSpreadsheet, File } from "lucide-react";

function getFileIcon(mimetype?: string) {
	if (!mimetype) return File;
	if (mimetype.startsWith("image/")) return FileImage;
	if (mimetype === "application/pdf") return FileText;
	if (
		mimetype.includes("spreadsheet") ||
		mimetype.includes("excel") ||
		mimetype === "text/csv"
	)
		return FileSpreadsheet;
	return FileText;
}

function formatFileSize(bytes?: number) {
	if (!bytes) return "-";
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}
	return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export const columns: ColumnDef<DocumentWithTags>[] = [
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
				className="translate-y-[2px]"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
				className="translate-y-[2px]"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	},
	{
		accessorKey: "name",
		header: "Name",
		cell: ({ row }) => {
			const document = row.original;
			const Icon = getFileIcon(document.metadata?.mimetype);
			const displayName =
				document.title ?? document.name?.split("/").pop() ?? "Untitled";

			return (
				<div className="flex items-center gap-3">
					<div className="flex-shrink-0 w-8 h-8 rounded bg-muted flex items-center justify-center">
						<Icon className="h-4 w-4 text-muted-foreground" />
					</div>
					<span className="font-medium truncate max-w-[200px]">
						{displayName}
					</span>
				</div>
			);
		},
	},
	{
		accessorKey: "tags",
		header: "Tags",
		cell: ({ row }) => {
			const document = row.original;
			const tags = document.documentTagAssignments ?? [];

			if (!tags.length) {
				return <span className="text-muted-foreground text-sm">-</span>;
			}

			return (
				<div className="flex gap-1 flex-wrap max-w-[200px]">
					{tags.slice(0, 3).map((tag) => (
						<Badge key={tag.documentTag.id} variant="secondary" className="text-xs">
							{tag.documentTag.name}
						</Badge>
					))}
					{tags.length > 3 && (
						<Badge variant="outline" className="text-xs">
							+{tags.length - 3}
						</Badge>
					)}
				</div>
			);
		},
	},
	{
		accessorKey: "size",
		header: "Size",
		cell: ({ row }) => {
			const document = row.original;
			return (
				<span className="text-muted-foreground text-sm">
					{formatFileSize(document.metadata?.size as number)}
				</span>
			);
		},
	},
	{
		accessorKey: "createdAt",
		header: "Created",
		cell: ({ row }) => {
			const document = row.original;
			const date = new Date(document.createdAt);

			return (
				<span className="text-muted-foreground text-sm" title={format(date, "PPpp")}>
					{formatDistanceToNow(date, { addSuffix: true })}
				</span>
			);
		},
	},
];

