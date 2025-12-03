import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { NotificationSettings } from "@/components/notification-settings";
import { NotificationSetting } from "@/components/notification-setting";

// Mock API
const mockRequest = vi.fn();
vi.mock("@/lib/api", async () => {
	const actual = await vi.importActual("@/lib/api");
	return {
		...actual,
		request: mockRequest,
	};
});

// Mock toast
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

describe("NotificationSettings", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
				mutations: {
					retry: false,
				},
			},
		});
		vi.clearAllMocks();
	});

	const renderWithProviders = (component: React.ReactElement) => {
		return render(
			<QueryClientProvider client={queryClient}>
				{component}
			</QueryClientProvider>,
		);
	};

	it("should render notification settings", async () => {
		mockRequest.mockResolvedValue({
			success: true,
			data: [],
		});

		renderWithProviders(<NotificationSettings />);

		await waitFor(() => {
			expect(mockRequest).toHaveBeenCalledWith("/api/v1/notification-settings");
		});
	});

	it("should display notification categories", async () => {
		mockRequest.mockResolvedValue({
			success: true,
			data: [
				{
					id: "1",
					notificationType: "invoice.created",
					channel: "email",
					enabled: true,
				},
			],
		});

		renderWithProviders(<NotificationSettings />);

		await waitFor(() => {
			expect(screen.getByText(/invoices/i)).toBeInTheDocument();
		});
	});
});

describe("NotificationSetting", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
				mutations: {
					retry: false,
				},
			},
		});
		vi.clearAllMocks();
	});

	const renderWithProviders = (component: React.ReactElement) => {
		return render(
			<QueryClientProvider client={queryClient}>
				{component}
			</QueryClientProvider>,
		);
	};

	const mockSettings = {
		type: "invoice.created",
		name: "Invoice Created",
		description: "Get notified when an invoice is created",
		settings: [
			{ channel: "in_app" as const, enabled: true },
			{ channel: "email" as const, enabled: true },
			{ channel: "push" as const, enabled: false },
		],
	};

	it("should render notification setting", () => {
		renderWithProviders(<NotificationSetting {...mockSettings} />);

		expect(screen.getByText("Invoice Created")).toBeInTheDocument();
		expect(
			screen.getByText("Get notified when an invoice is created"),
		).toBeInTheDocument();
	});

	it("should toggle notification channel", async () => {
		const user = userEvent.setup();
		mockRequest.mockResolvedValue({
			success: true,
		});

		renderWithProviders(<NotificationSetting {...mockSettings} />);

		const emailCheckbox = screen.getByLabelText(/email/i);
		await user.click(emailCheckbox);

		await waitFor(() => {
			expect(mockRequest).toHaveBeenCalledWith("/api/v1/notification-settings", {
				method: "PATCH",
				body: JSON.stringify({
					notificationType: "invoice.created",
					channel: "email",
					enabled: false,
				}),
			});
		});
	});
});

