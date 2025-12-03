import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { InviteForm } from "@/components/forms/invite-form";

// Mock API
const mockCreateInvite = vi.fn();
vi.mock("@/lib/api", async () => {
	const actual = await vi.importActual("@/lib/api");
	return {
		...actual,
		invitesApi: {
			create: mockCreateInvite,
		},
	};
});

// Mock toast
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
	},
}));

describe("InviteForm", () => {
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

	it("should render invite form", () => {
		renderWithProviders(<InviteForm />);

		expect(screen.getByPlaceholderText(/jane@example.com/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /send invites/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /add more/i })).toBeInTheDocument();
	});

	it("should allow adding multiple invite fields", async () => {
		const user = userEvent.setup();
		renderWithProviders(<InviteForm />);

		const addMoreButton = screen.getByRole("button", { name: /add more/i });
		await user.click(addMoreButton);

		const emailInputs = screen.getAllByPlaceholderText(/jane@example.com/i);
		expect(emailInputs.length).toBe(2);
	});

	it("should validate email format", async () => {
		const user = userEvent.setup();
		renderWithProviders(<InviteForm />);

		const emailInput = screen.getByPlaceholderText(/jane@example.com/i);
		const submitButton = screen.getByRole("button", { name: /send invites/i });

		await user.type(emailInput, "invalid-email");
		await user.click(submitButton);

		// Form should prevent submission with invalid email
		await waitFor(() => {
			expect(mockCreateInvite).not.toHaveBeenCalled();
		});
	});

	it("should submit valid invites", async () => {
		const user = userEvent.setup();
		mockCreateInvite.mockResolvedValue({
			success: true,
			data: {
				id: "invite-1",
				email: "test@example.com",
				role: "member",
				status: "pending",
				expiresAt: new Date().toISOString(),
				createdAt: new Date().toISOString(),
			},
		});

		renderWithProviders(<InviteForm />);

		const emailInput = screen.getByPlaceholderText(/jane@example.com/i);
		const submitButton = screen.getByRole("button", { name: /send invites/i });

		await user.type(emailInput, "test@example.com");
		await user.click(submitButton);

		await waitFor(() => {
			expect(mockCreateInvite).toHaveBeenCalledWith({
				email: "test@example.com",
				role: "member",
			});
		});
	});

	it("should handle multiple invites", async () => {
		const user = userEvent.setup();
		mockCreateInvite.mockResolvedValue({
			success: true,
			data: {},
		});

		renderWithProviders(<InviteForm />);

		const addMoreButton = screen.getByRole("button", { name: /add more/i });
		await user.click(addMoreButton);

		const emailInputs = screen.getAllByPlaceholderText(/jane@example.com/i);
		await user.type(emailInputs[0], "user1@example.com");
		await user.type(emailInputs[1], "user2@example.com");

		const submitButton = screen.getByRole("button", { name: /send invites/i });
		await user.click(submitButton);

		await waitFor(() => {
			expect(mockCreateInvite).toHaveBeenCalledTimes(2);
		});
	});

	it("should call onSuccess callback after successful invite", async () => {
		const user = userEvent.setup();
		const onSuccess = vi.fn();
		mockCreateInvite.mockResolvedValue({
			success: true,
			data: {},
		});

		renderWithProviders(<InviteForm onSuccess={onSuccess} />);

		const emailInput = screen.getByPlaceholderText(/jane@example.com/i);
		const submitButton = screen.getByRole("button", { name: /send invites/i });

		await user.type(emailInput, "test@example.com");
		await user.click(submitButton);

		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalled();
		});
	});
});

