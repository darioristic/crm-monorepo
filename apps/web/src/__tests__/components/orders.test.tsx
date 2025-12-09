import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Orders } from "@/components/orders";

// Mock API (use hoisted variable to avoid TDZ issues)
const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    request: mockRequest,
  };
});

describe("Orders", () => {
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

  it("should render orders component", () => {
    mockRequest.mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<Orders />);

    expect(screen.getByRole("heading", { name: /orders/i })).toBeInTheDocument();
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

    renderWithProviders(<Orders />);

    expect(screen.getByText(/loading orders/i)).toBeInTheDocument();
  });

  it("should display orders list", async () => {
    const mockOrders = [
      {
        id: "order-1",
        orderNumber: "ORD-001",
        status: "pending",
        total: 1200,
        currency: "EUR",
      },
      {
        id: "order-2",
        orderNumber: "ORD-002",
        status: "completed",
        total: 2500,
        currency: "EUR",
      },
    ];

    mockRequest.mockResolvedValue({
      success: true,
      data: mockOrders,
    });

    renderWithProviders(<Orders />);

    await waitFor(() => {
      expect(screen.getByText("ORD-001")).toBeInTheDocument();
      expect(screen.getByText("ORD-002")).toBeInTheDocument();
    });
  });

  it("should display empty state when no orders", async () => {
    mockRequest.mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<Orders />);

    await waitFor(() => {
      expect(screen.getByText(/no orders found/i)).toBeInTheDocument();
    });
  });
});
