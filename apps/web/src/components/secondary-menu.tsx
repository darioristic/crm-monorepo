"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
	path: string;
	label: string;
};

type Props = {
	items: Item[];
};

export function SecondaryMenu({ items }: Props) {
	const pathname = usePathname();

	return (
		<nav className="border-b border-border">
			<ul className="flex space-x-1 -mb-px overflow-x-auto scrollbar-hide">
				{items.map((item) => {
					const isActive = pathname === item.path;
					return (
						<Link
							prefetch
							key={item.path}
							href={item.path}
							className={cn(
								"relative px-4 py-3 text-sm font-medium transition-colors",
								"border-b-2 border-transparent",
								"hover:text-foreground",
								isActive
									? "text-foreground border-primary"
									: "text-muted-foreground hover:border-muted"
							)}
						>
							{item.label}
						</Link>
					);
				})}
			</ul>
		</nav>
	);
}

