"use client";

import { useDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	DropdownMenuCheckboxItem,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatISO, format } from "date-fns";
import { documentTagsApi } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FilterList, type Filter } from "@/components/filter-list";
import {
	SearchIcon,
	FilterIcon,
	CalendarMonthIcon,
	StatusIcon,
	AISparklesIcon,
} from "@/components/icons/custom-icons";
import { Loader2 } from "lucide-react";

interface AIFilterResponse {
	tags?: string[];
	dateRange?: {
		start?: string;
		end?: string;
	};
	searchQuery?: string;
}

export function VaultSearchFilter() {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const [isAILoading, setIsAILoading] = useState(false);

	// Prevent hydration mismatch by only setting state after mount
	useEffect(() => {
		setIsMounted(true);
	}, []);

	const { filter, setFilter } = useDocumentFilterParams();
	const [input, setInput] = useState(filter.q ?? "");

	const { data: tagsData } = useQuery({
		queryKey: ["document-tags"],
		queryFn: async () => {
			const response = await documentTagsApi.getAll();
			return response.data ?? [];
		},
		enabled: isOpen || Boolean(filter.tags?.length),
	});

	// AI Filter mutation
	const aiFilterMutation = useMutation({
		mutationFn: async (query: string): Promise<AIFilterResponse> => {
			const response = await fetch("/api/ai/filters/vault", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			});
			if (!response.ok) {
				throw new Error("AI filter request failed");
			}
			return response.json();
		},
		onSuccess: (data) => {
			const newFilter: Record<string, unknown> = {};

			if (data.searchQuery) {
				setInput(data.searchQuery);
				newFilter.q = data.searchQuery;
			}

			if (data.tags?.length) {
				// Find tag IDs from tag names
				const tagIds = data.tags
					.map((tagName) => {
						const tag = tagsData?.find(
							(t) => t.name.toLowerCase() === tagName.toLowerCase()
						);
						return tag?.id;
					})
					.filter(Boolean) as string[];

				if (tagIds.length) {
					newFilter.tags = tagIds;
				}
			}

			if (data.dateRange?.start) {
				newFilter.start = data.dateRange.start;
			}
			if (data.dateRange?.end) {
				newFilter.end = data.dateRange.end;
			}

			if (Object.keys(newFilter).length) {
				setFilter(newFilter as Parameters<typeof setFilter>[0]);
			}
		},
	});

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// meta+s or ctrl+s to focus search
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				inputRef.current?.focus();
			}
			// Escape to blur and close
			if (e.key === "Escape") {
				inputRef.current?.blur();
				setIsOpen(false);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handleSearch = (evt: React.ChangeEvent<HTMLInputElement>) => {
		const value = evt.target.value;

		if (value) {
			setInput(value);
		} else {
			setFilter({ q: null });
			setInput("");
		}
	};

	const handleSubmit = async (e?: React.FormEvent) => {
		e?.preventDefault();
		setFilter({ q: input.length > 0 ? input : null });
	};

	const handleAIFilter = useCallback(async () => {
		if (!input.trim()) return;

		setIsAILoading(true);
		try {
			await aiFilterMutation.mutateAsync(input);
		} finally {
			setIsAILoading(false);
		}
	}, [input, aiFilterMutation]);

	// Build active filters for FilterList
	const activeFilters: Filter[] = [];

	if (filter.start && filter.end) {
		activeFilters.push({
			id: "date-range",
			name: `${format(new Date(filter.start), "MMM d")} - ${format(new Date(filter.end), "MMM d, yyyy")}`,
			type: "date",
			value: `${filter.start}:${filter.end}`,
		});
	}

	filter.tags?.forEach((tagId) => {
		const tag = tagsData?.find((t) => t.id === tagId);
		if (tag) {
			activeFilters.push({
				id: `tag-${tagId}`,
				name: tag.name,
				type: "tag",
				value: tagId,
			});
		}
	});

	const handleRemoveFilter = (filterId: string) => {
		if (filterId === "date-range") {
			setFilter({ start: null, end: null });
		} else if (filterId.startsWith("tag-")) {
			const tagId = filterId.replace("tag-", "");
			setFilter({
				tags: filter.tags?.filter((t) => t !== tagId) ?? null,
			});
		}
	};

	const handleClearAll = () => {
		setFilter({ q: null, tags: null, start: null, end: null });
		setInput("");
	};

	const validFilters = Object.fromEntries(
		Object.entries(filter).filter(([key]) => key !== "q")
	);

	const hasValidFilters = Object.values(validFilters).some(
		(value) => value !== null
	);

	return (
		<div className="flex flex-col gap-2">
			<DropdownMenu 
				open={isMounted ? isOpen : false} 
				onOpenChange={setIsOpen}
				modal={isMounted}
			>
				<div className="flex space-x-2 items-center" suppressHydrationWarning>
					<form
						className="relative"
						onSubmit={(e) => {
							e.preventDefault();
							handleSubmit();
						}}
					>
						<SearchIcon className="absolute pointer-events-none left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							ref={inputRef}
							placeholder="Search documents..."
							className="pl-9 w-full md:w-[350px] pr-20"
							value={input}
							onChange={handleSearch}
							autoComplete="off"
							autoCapitalize="none"
							autoCorrect="off"
							spellCheck="false"
						/>

						<div className="absolute z-10 right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
							{/* AI Filter Button */}
							<button
								type="button"
								onClick={handleAIFilter}
								disabled={isAILoading || !input.trim()}
								className={cn(
									"p-1 rounded transition-colors",
									"opacity-50 hover:opacity-100 disabled:opacity-30",
									isAILoading && "animate-pulse"
								)}
								title="Use AI to parse filters"
							>
								{isAILoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<AISparklesIcon className="h-4 w-4" />
								)}
							</button>

							{/* Filter Dropdown Trigger */}
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									suppressHydrationWarning
									className={cn(
										"p-1 rounded transition-opacity duration-300",
										"opacity-50 hover:opacity-100",
										hasValidFilters && "opacity-100",
										isOpen && "opacity-100"
									)}
								>
									<FilterIcon className="h-4 w-4" />
								</button>
							</DropdownMenuTrigger>
						</div>
					</form>

					{/* Keyboard shortcut hint */}
					<kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
						⌘S
					</kbd>
				</div>

				<DropdownMenuContent
					className="w-[350px]"
					align="end"
					sideOffset={8}
					alignOffset={-11}
					side="bottom"
				>
					<DropdownMenuGroup>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<CalendarMonthIcon className="mr-2 h-4 w-4" />
								<span>Date</span>
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent
								sideOffset={14}
								alignOffset={-4}
								className="p-0"
							>
								<Calendar
									mode="range"
									initialFocus
									toDate={new Date()}
									selected={
										filter.start || filter.end
											? {
													from: filter.start
														? new Date(filter.start)
														: undefined,
													to: filter.end ? new Date(filter.end) : undefined,
												}
											: undefined
									}
									onSelect={(range) => {
										if (!range) return;

										const newRange = {
											start: range.from
												? formatISO(range.from, { representation: "date" })
												: filter.start,
											end: range.to
												? formatISO(range.to, { representation: "date" })
												: filter.end,
										};

										setFilter(newRange);
									}}
								/>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					</DropdownMenuGroup>

					<DropdownMenuGroup>
						<DropdownMenuSub>
							<DropdownMenuSubTrigger>
								<StatusIcon className="mr-2 h-4 w-4" />
								<span>Tags</span>
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent
								sideOffset={14}
								alignOffset={-4}
								className="p-0 max-h-[300px] overflow-y-auto"
							>
								{tagsData?.map((tag) => (
									<DropdownMenuCheckboxItem
										key={tag.id}
										checked={filter.tags?.includes(tag.id)}
										onCheckedChange={() => {
											setFilter({
												tags: filter?.tags?.includes(tag.id)
													? filter.tags.filter((s) => s !== tag.id)
													: [...(filter?.tags ?? []), tag.id],
											});
										}}
									>
										{tag.name}
									</DropdownMenuCheckboxItem>
								))}

								{!tagsData?.length && (
									<DropdownMenuItem disabled>No tags found</DropdownMenuItem>
								)}
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					</DropdownMenuGroup>

					{hasValidFilters && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={handleClearAll}
								className="text-muted-foreground"
							>
								Clear all filters
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Active filters using FilterList */}
			<FilterList
				filters={activeFilters}
				onRemove={handleRemoveFilter}
				onClearAll={activeFilters.length > 1 ? handleClearAll : undefined}
			/>
		</div>
	);
}
