"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RiLockLine, RiMailLine, RiLoader4Line, RiEyeLine, RiEyeOffLine } from "@remixicon/react";
import { login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

// ============================================
// Form Schema
// ============================================

const loginSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ============================================
// Login Form Component (uses useSearchParams)
// ============================================

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const returnUrl = searchParams.get("returnUrl") || "/dashboard";

	const [isLoading, setIsLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema) as any,
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const onSubmit = async (data: LoginFormData) => {
		setIsLoading(true);
		setError(null);

		try {
			const result = await login(data);

			if (result.success) {
				router.push(returnUrl);
				router.refresh();
			} else {
				setError(result.error?.message || "Login failed");
			}
		} catch (err) {
			setError("An error occurred. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			{/* Error Alert */}
			{error && (
				<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
					{error}
				</div>
			)}

			{/* Email Field */}
			<div className="space-y-2">
				<Label htmlFor="email">Email Address</Label>
				<div className="relative">
					<RiMailLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						id="email"
						type="email"
						placeholder="you@example.com"
						className="pl-10"
						autoComplete="email"
						disabled={isLoading}
						aria-invalid={!!errors.email}
						{...register("email")}
					/>
				</div>
				{errors.email && (
					<p className="text-xs text-destructive">{errors.email.message}</p>
				)}
			</div>

			{/* Password Field */}
			<div className="space-y-2">
				<Label htmlFor="password">Password</Label>
				<div className="relative">
					<RiLockLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						id="password"
						type={showPassword ? "text" : "password"}
						placeholder="••••••••"
						className="pl-10 pr-10"
						autoComplete="current-password"
						disabled={isLoading}
						aria-invalid={!!errors.password}
						{...register("password")}
					/>
					<button
						type="button"
						onClick={() => setShowPassword(!showPassword)}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						tabIndex={-1}
					>
						{showPassword ? (
							<RiEyeOffLine className="h-4 w-4" />
						) : (
							<RiEyeLine className="h-4 w-4" />
						)}
					</button>
				</div>
				{errors.password && (
					<p className="text-xs text-destructive">{errors.password.message}</p>
				)}
			</div>

			{/* Submit Button */}
			<Button type="submit" className="w-full" disabled={isLoading}>
				{isLoading ? (
					<>
						<RiLoader4Line className="h-4 w-4 animate-spin" />
						<span>Signing in...</span>
					</>
				) : (
					"Sign In"
				)}
			</Button>
		</form>
	);
}

// ============================================
// Login Page
// ============================================

export default function LoginPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
			<div className="w-full max-w-md">
				{/* Logo/Brand */}
				<div className="mb-8 text-center">
					<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
						<RiLockLine className="h-7 w-7 text-primary" />
					</div>
					<h1 className="text-2xl font-bold tracking-tight">CRM System</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Manage customers, sales, and projects
					</p>
				</div>

				{/* Login Card */}
				<Card className="border-border/50 shadow-lg">
					<CardHeader className="space-y-1 text-center">
						<CardTitle className="text-xl">Welcome Back</CardTitle>
						<CardDescription>
							Enter your credentials to sign in
						</CardDescription>
					</CardHeader>

					<CardContent>
						<Suspense fallback={<div className="h-48 flex items-center justify-center"><RiLoader4Line className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
							<LoginForm />
						</Suspense>

						{/* Development Helper */}
						{process.env.NODE_ENV === "development" && (
							<div className="mt-6 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-3">
								<p className="mb-2 text-xs font-medium text-muted-foreground">
									Demo Credentials:
								</p>
								<div className="space-y-1 text-xs text-muted-foreground">
									<p>
										<span className="font-medium">Admin:</span> admin@crm.local
									</p>
									<p>
										<span className="font-medium">User:</span> sarah.johnson@techcorp.com
									</p>
									<p>
										<span className="font-medium">Password:</span> changeme123
									</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Footer */}
				<p className="mt-6 text-center text-xs text-muted-foreground">
					&copy; {new Date().getFullYear()} CRM System. All rights reserved.
				</p>
			</div>
		</div>
	);
}
