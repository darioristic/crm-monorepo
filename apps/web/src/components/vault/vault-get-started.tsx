"use client";

import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";

export function VaultGetStarted() {
	return (
		<div className="h-[calc(100vh-300px)] flex items-center justify-center">
			<div className="relative z-20 m-auto flex w-full max-w-[400px] flex-col">
				<div className="flex w-full flex-col relative text-center">
					<div className="mx-auto mb-4 p-3 rounded-full bg-muted">
						<FileText className="h-8 w-8 text-muted-foreground" />
					</div>

					<div className="pb-4">
						<h2 className="font-semibold text-lg">Always find what you need</h2>
					</div>

					<p className="pb-6 text-sm text-muted-foreground">
						Drag & drop or upload your documents. We&apos;ll automatically
						organize them with tags based on content, making them easy and
						secure to find.
					</p>

					<Button
						variant="outline"
						onClick={() => document.getElementById("vault-upload-input")?.click()}
						className="gap-2"
					>
						<Upload className="h-4 w-4" />
						Upload
					</Button>
				</div>
			</div>
		</div>
	);
}

