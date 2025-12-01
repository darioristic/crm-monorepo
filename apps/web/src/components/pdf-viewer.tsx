"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
	url: string;
	maxWidth?: number;
}

export function PdfViewer({ url, maxWidth }: PdfViewerProps) {
	const [numPages, setNumPages] = useState<number>();
	const [isPasswordProtected, setIsPasswordProtected] = useState(false);
	const [passwordCancelled, setPasswordCancelled] = useState(false);
	const [password, setPassword] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
	const [submittedPassword, setSubmittedPassword] = useState<string | null>(
		null,
	);
	const [pendingCallback, setPendingCallback] = useState<
		((password: string | null) => void) | null
	>(null);

	function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
		setNumPages(numPages);
		setIsPasswordProtected(false);
		setPasswordCancelled(false);
		setPassword("");
		setPasswordError("");
		setIsSubmittingPassword(false);
		setSubmittedPassword(null);
		setPendingCallback(null);
	}

	function onDocumentLoadError(error: Error): void {
		const errorMessage = error.message.toLowerCase();
		if (
			errorMessage.includes("password") ||
			errorMessage.includes("encrypted")
		) {
			setIsPasswordProtected(true);
		}
	}

	function onPassword(
		callback: (password: string | null) => void,
		reason: number,
	): void {
		// PasswordResponses.NEED_PASSWORD = 1
		// PasswordResponses.INCORRECT_PASSWORD = 2
		if (reason === 1) {
			if (submittedPassword) {
				callback(submittedPassword);
				return;
			}
			setPendingCallback(() => callback);
			setIsPasswordProtected(true);
			setPasswordError("");
		} else if (reason === 2) {
			setPendingCallback(() => callback);
			setPasswordError("Invalid password. Please try again.");
			setIsSubmittingPassword(false);
			setIsPasswordProtected(true);
			setSubmittedPassword(null);
		} else {
			callback(null);
		}
	}

	function handlePasswordSubmit() {
		if (pendingCallback && password.trim()) {
			setIsSubmittingPassword(true);
			setPasswordError("");
			setIsPasswordProtected(false);
			setSubmittedPassword(password);
			pendingCallback(password);
		}
	}

	if (isPasswordProtected && passwordCancelled) {
		return (
			<div className="flex flex-col w-full h-full overflow-hidden items-center justify-center p-8">
				<Alert className="max-w-md">
					<Lock className="h-4 w-4" />
					<AlertDescription>
						This PDF is password protected and cannot be viewed without the
						correct password.
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex flex-col w-full h-full overflow-hidden rounded-lg",
				numPages && "bg-white",
			)}
		>
			<ScrollArea className="w-full flex-1">
				{isPasswordProtected && !isSubmittingPassword ? (
					<div className="absolute inset-0 flex items-center justify-center p-8 bg-background">
						<div className="max-w-md w-full space-y-6 text-center">
							<div className="space-y-1">
								<Lock className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
								<h3 className="text-muted-foreground">
									This document is password protected.
								</h3>
								<p className="text-xs text-muted-foreground">
									Please enter the password below.
								</p>
							</div>
							<div className="space-y-2">
								<form
									onSubmit={(e) => {
										e.preventDefault();
										handlePasswordSubmit();
									}}
									autoComplete="off"
								>
									<Input
										type="password"
										placeholder="Enter password"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										disabled={isSubmittingPassword}
										className="text-center"
									/>
								</form>
								{passwordError && (
									<p className="text-sm text-destructive">{passwordError}</p>
								)}
							</div>
						</div>
					</div>
				) : (
					<div className="pb-8">
						<Document
							key={`${url}_${isPasswordProtected}`}
							file={url}
							onLoadSuccess={onDocumentLoadSuccess}
							onLoadError={onDocumentLoadError}
							onPassword={onPassword}
							loading={
								<div className="flex items-center justify-center p-8">
									<Skeleton className="w-full h-[600px]" />
								</div>
							}
							error={
								<div className="flex flex-col items-center justify-center p-8 text-center">
									<AlertCircle className="h-8 w-8 text-muted-foreground mb-4" />
									<p className="text-sm text-muted-foreground">
										Failed to load PDF. The file may be corrupted or
										unsupported.
									</p>
								</div>
							}
						>
							{numPages &&
								Array.from(new Array(numPages), (_, index) => (
									<Page
										width={maxWidth}
										key={`${url}_${index + 1}`}
										pageNumber={index + 1}
										renderAnnotationLayer={false}
										renderTextLayer={true}
										className="mb-2"
									/>
								))}
						</Document>
					</div>
				)}
			</ScrollArea>
		</div>
	);
}

