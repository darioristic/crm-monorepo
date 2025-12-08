import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { logger } from "@/lib/logger";
import { InvoicePublicView } from "./invoice-public-view";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  // Fetch invoice data for metadata
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${baseUrl}/api/invoices/token/${token}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        title: "Invoice Not Found",
      };
    }

    const data = await response.json();
    const invoice = data.data;

    return {
      title: `Invoice ${invoice?.invoiceNumber || token}`,
      description: `Invoice from ${invoice?.team?.name || ""}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  } catch {
    return {
      title: "Invoice",
    };
  }
}

export default async function InvoicePublicPage({ params }: Props) {
  const { token } = await params;

  // Fetch invoice data
  let invoice = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${baseUrl}/api/invoices/token/${token}`, {
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      invoice = data.data;

      // Update viewed_at timestamp
      await fetch(`${baseUrl}/api/invoices/token/${token}/viewed`, {
        method: "POST",
      }).catch(() => {});
    }
  } catch (error) {
    logger.error("Error fetching invoice:", error);
  }

  if (!invoice) {
    notFound();
  }

  return <InvoicePublicView invoice={invoice} token={token} />;
}
