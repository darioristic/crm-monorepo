"use client";

import {
	getCategoryDisplayTitle,
	getNotificationDisplayInfoWithFallback,
} from "@/utils/notification-definitions";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { NotificationSetting } from "./notification-setting";

export function NotificationSettingsSkeleton() {
	return (
		<div className="space-y-6">
			{[...Array(3)].map((_, categoryIndex) => (
				<div key={categoryIndex.toString()} className="border-b border-border">
					{/* Category header skeleton - closed accordion */}
					<div className="flex flex-1 items-center justify-between py-4">
						<Skeleton className="h-5 w-24" />
						<ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
					</div>
				</div>
			))}
		</div>
	);
}

type NotificationType = {
	type: string;
	category: string;
	order: number;
	settings: Array<{
		channel: "in_app" | "email" | "push";
		enabled: boolean;
	}>;
};

export function NotificationSettings() {
	// TODO: Implement actual API call for notification settings
	const { data: notificationTypes, isLoading } = useQuery<NotificationType[]>({
		queryKey: ["notificationSettings", "getAll"],
		queryFn: async () => {
			// Placeholder - implement actual API call
			// Return sample data for now
			return [
				{
					type: "invoice.created",
					category: "invoices",
					order: 1,
					settings: [
						{ channel: "in_app", enabled: true },
						{ channel: "email", enabled: true },
						{ channel: "push", enabled: false },
					],
				},
				{
					type: "invoice.paid",
					category: "invoices",
					order: 2,
					settings: [
						{ channel: "in_app", enabled: true },
						{ channel: "email", enabled: true },
						{ channel: "push", enabled: false },
					],
				},
				{
					type: "transaction.created",
					category: "transactions",
					order: 1,
					settings: [
						{ channel: "in_app", enabled: true },
						{ channel: "email", enabled: false },
						{ channel: "push", enabled: false },
					],
				},
				{
					type: "team.member.invited",
					category: "team",
					order: 1,
					settings: [
						{ channel: "in_app", enabled: true },
						{ channel: "email", enabled: true },
						{ channel: "push", enabled: false },
					],
				},
			];
		},
	});

	if (isLoading) {
		return <NotificationSettingsSkeleton />;
	}

	// Group notifications by category
	const groupedNotifications = notificationTypes?.reduce(
		(acc, notificationType) => {
			// Include all channel settings (in_app, email, push)
			const filteredSettings = notificationType.settings.filter(
				(
					setting,
				): setting is {
					channel: "in_app" | "email" | "push";
					enabled: boolean;
				} =>
					setting.channel === "in_app" ||
					setting.channel === "email" ||
					setting.channel === "push",
			);

			// Skip if no settings remain after filtering
			if (filteredSettings.length === 0) return acc;

			const category = notificationType.category || "other";
			const order = notificationType.order || 999;

			if (!acc[category]) {
				acc[category] = {
					category,
					order,
					notifications: [],
				};
			}

			// Get display info
			const displayInfo = getNotificationDisplayInfoWithFallback(
				notificationType.type,
			);

			acc[category].notifications.push({
				type: notificationType.type,
				name: displayInfo.name,
				description: displayInfo.description,
				settings: filteredSettings,
			});

			return acc;
		},
		{} as Record<
			string,
			{
				category: string;
				order: number;
				notifications: Array<{
					type: string;
					name: string;
					description: string;
					settings: Array<{
						channel: "in_app" | "email" | "push";
						enabled: boolean;
					}>;
				}>;
			}
		>,
	);

	// Sort categories by order, then by name
	const sortedCategories = Object.values(groupedNotifications || {}).sort(
		(a, b) => {
			if (a.order !== b.order) {
				return a.order - b.order;
			}
			return a.category.localeCompare(b.category);
		},
	);

	return (
		<div className="space-y-6">
			<Accordion type="multiple" className="w-full">
				{sortedCategories.map((categoryGroup) => (
					<AccordionItem
						key={categoryGroup.category}
						value={categoryGroup.category}
					>
						<AccordionTrigger className="text-base">
							{getCategoryDisplayTitle(categoryGroup.category)}
						</AccordionTrigger>
						<AccordionContent>
							<div className="space-y-4 pt-2">
								{categoryGroup.notifications.map((notification) => (
									<NotificationSetting
										key={notification.type}
										type={notification.type}
										name={notification.name}
										description={notification.description}
										settings={notification.settings}
									/>
								))}
							</div>
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	);
}

