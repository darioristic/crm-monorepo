import { generateMeta } from "@/lib/utils";
import { DeliveryNoteForm } from "@/components/sales/delivery-note-form";

export async function generateMetadata() {
  return generateMeta({
    title: "New Delivery Note",
    description: "Create a new delivery note",
    canonical: "/dashboard/sales/delivery-notes/new",
  });
}

export default function NewDeliveryNotePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Delivery Note</h1>
        <p className="text-muted-foreground">
          Create a new delivery note for shipping products
        </p>
      </div>
      <DeliveryNoteForm mode="create" />
    </div>
  );
}

