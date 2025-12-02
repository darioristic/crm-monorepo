"use client";

import { useTeamMutation, useTeamQuery } from "@/hooks/use-team";
import { useUpload } from "@/hooks/use-upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { stripSpecialCharacters } from "@/lib/utils/strip-special-characters";
import { useRef } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompanyLogo() {
	const inputRef = useRef<HTMLInputElement>(null);
	const { isLoading, uploadFile } = useUpload();
	const { data } = useTeamQuery();
	const { mutate: updateTeam } = useTeamMutation();

	const handleUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
		const { files } = evt.target;
		const selectedFile = files as FileList;

		const filename = stripSpecialCharacters(selectedFile[0]?.name ?? "");

		const { url } = await uploadFile({
			bucket: "avatars",
			path: [data?.id ?? "", filename],
			file: selectedFile[0] as File,
		});

		if (url) {
			updateTeam({ logoUrl: url });
		}
	};

	const hasLogo = !!data?.logoUrl;

	return (
		<Card className="border-border/50">
			<CardHeader className="pb-4">
				<CardTitle className="text-base font-medium">Company Logo</CardTitle>
				<CardDescription className="text-sm">
					Upload your company logo. This will be displayed across your account.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-start gap-6">
					<div className="relative group">
						<Avatar
							className={cn(
								"w-24 h-24 flex items-center justify-center cursor-pointer transition-all",
								"rounded-xl border-2 border-border hover:border-primary/50",
								"bg-muted/50 hover:bg-muted",
								!hasLogo && "border-dashed"
							)}
							onClick={() => inputRef?.current?.click()}
						>
							{isLoading ? (
								<Spinner className="h-6 w-6" />
							) : hasLogo ? (
								<>
									<AvatarImage
										src={data.logoUrl ?? undefined}
										alt={data?.name ?? undefined}
										width={96}
										height={96}
										className="rounded-xl object-cover"
									/>
									<AvatarFallback className="rounded-xl bg-muted">
										<ImageIcon className="h-10 w-10 text-muted-foreground" />
									</AvatarFallback>
								</>
							) : (
								<div className="flex flex-col items-center justify-center gap-2">
									<Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
									<span className="text-xs text-muted-foreground font-medium">
										Upload
									</span>
								</div>
							)}
						</Avatar>
						{hasLogo && (
							<div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
								<div className="flex flex-col items-center gap-1">
									<Upload className="h-5 w-5 text-white" />
									<span className="text-xs text-white font-medium">Change</span>
								</div>
							</div>
						)}
						<input
							ref={inputRef}
							type="file"
							accept="image/*"
							style={{ display: "none" }}
							multiple={false}
							onChange={handleUpload}
						/>
					</div>
					<div className="flex-1 pt-1">
						<p className="text-sm text-muted-foreground">
							Recommended size: 512x512px. Supported formats: JPG, PNG, GIF.
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

