"use client";

import { DocumentDetails } from "@/components/document-details";
import { useDocumentParams } from "@/hooks/use-document-params";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function DocumentSheet() {
	const { params, setParams } = useDocumentParams();

	const isOpen = Boolean(params.filePath || params.documentId);

	return (
		<Sheet
			open={isOpen}
			onOpenChange={() => setParams({ documentId: null, filePath: null })}
		>
			<SheetContent className="w-full sm:max-w-[650px] p-0 overflow-hidden">
				<DocumentDetails />
			</SheetContent>
		</Sheet>
	);
}

