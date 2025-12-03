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
import { AlertTriangle, RefreshCcw, LayoutDashboard, HelpCircle } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Dashboard error:", error);
		
		// Capture error in Sentry
		import("@/lib/sentry").then(({ captureException }) => {
			captureException(error, { context: "dashboard_error_boundary" });
		});
	}, [error]);

	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
			<Card className="w-full max-w-lg">
				<CardHeader className="text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
						<AlertTriangle className="h-8 w-8 text-amber-500" />
					</div>
					<CardTitle className="text-xl">Dashboard Error</CardTitle>
					<CardDescription className="text-balance">
						We encountered an error while loading this section of the dashboard.
						Your data is safe - please try again.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{process.env.NODE_ENV === "development" && error.message && (
						<div className="rounded-lg border bg-muted/50 p-4">
							<p className="text-xs font-medium text-muted-foreground mb-1">
								Error details (development only):
							</p>
							<p className="text-sm font-mono text-foreground/80 break-all">
								{error.message}
							</p>
						</div>
					)}
					{error.digest && (
						<p className="text-center text-xs text-muted-foreground">
							Reference: {error.digest}
						</p>
					)}
				</CardContent>
				<CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
					<Button onClick={reset} size="lg">
						<RefreshCcw className="mr-2 h-4 w-4" />
						Try again
					</Button>
					<Button variant="outline" size="lg" asChild>
						<Link href="/dashboard">
							<LayoutDashboard className="mr-2 h-4 w-4" />
							Dashboard home
						</Link>
					</Button>
					<Button variant="ghost" size="lg" asChild>
						<Link href="/dashboard/settings">
							<HelpCircle className="mr-2 h-4 w-4" />
							Get help
						</Link>
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}

