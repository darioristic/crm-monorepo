"use client";

import { documentsApi } from "@/lib/api";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";

type Props = {
	id: string;
	filePath: string[];
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
};

export function DeleteVaultFileDialog({
	id,
	filePath,
	isOpen,
	onOpenChange,
}: Props) {
	const queryClient = useQueryClient();
	const [isDeleting, setIsDeleting] = useState(false);

	const deleteDocumentMutation = useMutation({
		mutationFn: () => documentsApi.delete(id),
		onMutate: () => {
			setIsDeleting(true);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["documents"] });
			onOpenChange(false);
		},
		onError: () => {
			setIsDeleting(false);
		},
		onSettled: () => {
			setIsDeleting(false);
		},
	});

	const handleDelete = () => {
		deleteDocumentMutation.mutate();
	};

	const fileName = filePath.at(-1) ?? "this file";

	return (
		<AlertDialog open={isOpen} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="flex items-center gap-2 text-sm">
						<AlertTriangle className="h-4 w-4 text-destructive" />
						Delete File
					</AlertDialogTitle>
					<AlertDialogDescription>
						<p>
							You are about to delete <strong>{fileName}</strong> from your vault.
						</p>
						<p className="text-sm text-muted-foreground mt-2">
							This action cannot be undone.
						</p>
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDelete}
						disabled={isDeleting}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{isDeleting ? (
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin" />
								Deleting...
							</div>
						) : (
							"Delete File"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

