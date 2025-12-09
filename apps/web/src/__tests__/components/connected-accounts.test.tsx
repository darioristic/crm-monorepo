import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectedAccounts } from "@/components/connected-accounts";

// Mock API (use hoisted variable to avoid TDZ issues)
const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    request: mockRequest,
  };
});

describe("ConnectedAccounts", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  it("should render connected accounts component", () => {
    mockRequest.mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<ConnectedAccounts />);

    expect(
      screen.getByText(/accounts/i, { selector: "[data-slot='card-title']" })
    ).toBeInTheDocument();
  });

  it("should display loading state", () => {
    mockRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                success: true,
                data: [],
              }),
            1000
          );
        })
    );

    const { container } = renderWithProviders(<ConnectedAccounts />);

    // Skeleton should be visible during loading
    expect(
      screen.getByText(/accounts/i, { selector: "[data-slot='card-title']" })
    ).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("should display connected accounts list", async () => {
    const mockAccounts = [
      {
        id: "account-1",
        accountName: "Main Account",
        bankName: "Test Bank",
        iban: "GB82WEST12345698765432",
        balance: 50000,
        currency: "EUR",
      },
    ];

    mockRequest.mockResolvedValue({
      success: true,
      data: mockAccounts,
    });

    renderWithProviders(<ConnectedAccounts />);

    await waitFor(() => {
      expect(screen.getByText("Main Account")).toBeInTheDocument();
      expect(screen.getByText("Test Bank")).toBeInTheDocument();
    });
  });

  it("should display empty state when no accounts", async () => {
    mockRequest.mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<ConnectedAccounts />);

    await waitFor(() => {
      expect(screen.getByText(/no bank accounts connected/i)).toBeInTheDocument();
    });
  });

  it("should render add account button", () => {
    mockRequest.mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<ConnectedAccounts />);

    expect(screen.getByRole("button", { name: /add account/i })).toBeInTheDocument();
  });
});
