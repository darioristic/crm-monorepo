"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Application error:", error);
	}, [error]);

	return (
		<div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
						<AlertTriangle className="h-8 w-8 text-destructive" />
					</div>
					<CardTitle className="text-xl">Something went wrong</CardTitle>
					<CardDescription>
						An unexpected error has occurred. Please try again or contact support
						if the issue persists.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{process.env.NODE_ENV === "development" && (
						<div className="rounded-md bg-muted p-3">
							<p className="text-xs font-mono text-muted-foreground break-all">
								{error.message}
							</p>
						</div>
					)}
					{error.digest && (
						<p className="mt-2 text-center text-xs text-muted-foreground">
							Error ID: {error.digest}
						</p>
					)}
				</CardContent>
				<CardFooter className="flex flex-col gap-2 sm:flex-row">
					<Button onClick={reset} className="w-full sm:w-auto">
						<RefreshCcw className="mr-2 h-4 w-4" />
						Try again
					</Button>
					<Button variant="outline" asChild className="w-full sm:w-auto">
						<Link href="/">
							<Home className="mr-2 h-4 w-4" />
							Go home
						</Link>
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}

