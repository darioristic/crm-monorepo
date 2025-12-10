import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationSetting } from "@/components/notification-setting";
import { NotificationSettings } from "@/components/notification-settings";

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
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
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
    mockRequest.mockImplementationOnce(async () => ({
      success: true,
      data: [
        {
          id: "1",
          notificationType: "invoice.created",
          channel: "email",
          enabled: true,
        },
      ],
    }));

    renderWithProviders(<NotificationSettings />);

    await waitFor(() => {
      expect(screen.getByText(/invoices/i)).toBeInTheDocument();
    });
  });

  it("should show default categories when fetch fails", async () => {
    mockRequest.mockRejectedValue(new Error("Network error"));
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
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
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
    expect(screen.getByText("Get notified when an invoice is created")).toBeInTheDocument();
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

  it("should optimistically update checkbox in settings list", async () => {
    const user = userEvent.setup();
    mockRequest.mockResolvedValue({
      success: true,
      data: [
        {
          id: "1",
          notificationType: "invoice.created",
          channel: "in_app",
          enabled: true,
        },
        {
          id: "2",
          notificationType: "invoice.created",
          channel: "email",
          enabled: true,
        },
        {
          id: "3",
          notificationType: "invoice.created",
          channel: "push",
          enabled: false,
        },
      ],
    });

    renderWithProviders(<NotificationSettings />);
    const invoicesTrigger = await screen.findByText(/invoices/i);
    await user.click(invoicesTrigger);
    const emailCheckbox = document.getElementById("invoice.created-email") as HTMLElement;
    expect(emailCheckbox).toHaveAttribute("data-state", "checked");

    mockRequest.mockImplementationOnce(async () => ({ success: true }));
    mockRequest.mockImplementationOnce(async () => ({
      success: true,
      data: [
        {
          id: "1",
          notificationType: "invoice.created",
          channel: "in_app",
          enabled: true,
        },
        {
          id: "2",
          notificationType: "invoice.created",
          channel: "email",
          enabled: false,
        },
        {
          id: "3",
          notificationType: "invoice.created",
          channel: "push",
          enabled: false,
        },
      ],
    }));
    await user.click(emailCheckbox);
    await waitFor(() => {
      const updated = document.getElementById("invoice.created-email") as HTMLElement;
      expect(updated).toHaveAttribute("data-state", "unchecked");
    });
  });
});
