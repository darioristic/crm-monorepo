"use client";

import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { documentsApi } from "@/lib/api";
import { useState } from "react";
import { DeleteVaultFileDialog } from "./delete-vault-file-dialog";
import { Download, Copy, Check, Trash2 } from "lucide-react";

type Props = {
	id: string;
	filePath: string[];
	hideDelete?: boolean;
};

export function VaultItemActions({ id, filePath, hideDelete }: Props) {
	const [copiedText, copy] = useCopyToClipboard();
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const downloadUrl = documentsApi.getDownloadUrl(filePath);
	const fileName = filePath.at(-1);

	const handleDownload = () => {
		const link = document.createElement("a");
		link.href = downloadUrl;
		link.download = fileName || "download";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const handleCopyLink = async () => {
		const fullUrl = window.location.origin + downloadUrl;
		await copy(fullUrl);
	};

	return (
		<div
			className="flex flex-row gap-1"
			onClick={(e) => e.stopPropagation()}
		>
			<Button
				variant="outline"
				size="icon"
				className="rounded-full h-7 w-7 bg-background"
				onClick={handleDownload}
			>
				<Download className="h-3.5 w-3.5" />
			</Button>

			<Button
				variant="outline"
				size="icon"
				type="button"
				onClick={handleCopyLink}
				className="rounded-full h-7 w-7 bg-background"
			>
				{copiedText ? (
					<Check className="h-3.5 w-3.5" />
				) : (
					<Copy className="h-3.5 w-3.5" />
				)}
			</Button>

			{!hideDelete && (
				<Button
					variant="outline"
					size="icon"
					className="rounded-full h-7 w-7 bg-background"
					onClick={() => setShowDeleteDialog(true)}
				>
					<Trash2 className="h-3.5 w-3.5" />
				</Button>
			)}

			<DeleteVaultFileDialog
				id={id}
				filePath={filePath}
				isOpen={showDeleteDialog}
				onOpenChange={setShowDeleteDialog}
			/>
		</div>
	);
}

