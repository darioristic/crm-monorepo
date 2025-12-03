import { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeliveryNotePublicView } from "./delivery-note-public-view";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${baseUrl}/api/delivery-notes/token/${token}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        title: "Delivery Note Not Found",
      };
    }

    const data = await response.json();
    const deliveryNote = data.data;

    return {
      title: `Delivery Note ${deliveryNote?.deliveryNumber || token}`,
      description: `Delivery Note from ${deliveryNote?.company?.name || ""}`,
      robots: {
        index: false,
        follow: false,
      },
    };
  } catch {
    return {
      title: "Delivery Note",
    };
  }
}

export default async function DeliveryNotePublicPage({ params }: Props) {
  const { token } = await params;

  let deliveryNote = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const response = await fetch(`${baseUrl}/api/delivery-notes/token/${token}`, {
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      deliveryNote = data.data;
    }
  } catch (error) {
    console.error("Error fetching delivery note:", error);
  }

  if (!deliveryNote) {
    notFound();
  }

  return <DeliveryNotePublicView deliveryNote={deliveryNote} token={token} />;
}

