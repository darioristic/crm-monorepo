import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { logger } from "@/lib/logger";
import { SharedDocumentView } from "./shared-document-view";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ password?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${baseUrl}/api/v1/public/document/${token}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        title: "Document Not Found",
      };
    }

    const data = await response.json();
    const document = data.data?.document;

    return {
      title: document?.title || "Shared Document",
      description: document?.summary || "View shared document",
      robots: {
        index: false,
        follow: false,
      },
    };
  } catch {
    return {
      title: "Shared Document",
    };
  }
}

export default async function SharedDocumentPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { password } = await searchParams;

  let documentData = null;
  let shareData = null;
  let requiresPassword = false;
  let error: string | null = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const passwordParam = password ? `?password=${encodeURIComponent(password)}` : "";
    const response = await fetch(`${baseUrl}/api/v1/public/document/${token}${passwordParam}`, {
      cache: "no-store",
    });

    const data = await response.json();

    if (response.ok && data.success) {
      documentData = data.data.document;
      shareData = data.data.share;
    } else if (data.error?.code === "UNAUTHORIZED") {
      requiresPassword = true;
      if (password) {
        error = "Invalid password";
      }
    } else if (data.error?.code === "FORBIDDEN") {
      error = data.error.message || "This share link has expired or reached its view limit";
    } else if (data.error?.code === "NOT_FOUND") {
      notFound();
    } else {
      error = data.error?.message || "Failed to load document";
    }
  } catch (err) {
    logger.error("Error fetching shared document:", err);
    error = "Failed to load document";
  }

  return (
    <SharedDocumentView
      token={token}
      document={documentData}
      share={shareData}
      requiresPassword={requiresPassword}
      error={error}
    />
  );
}
