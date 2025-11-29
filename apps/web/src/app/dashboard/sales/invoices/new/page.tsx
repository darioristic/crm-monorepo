import { generateMeta } from "@/lib/utils";
import { InvoiceForm } from "@/components/sales/invoice-form";

export async function generateMetadata() {
  return generateMeta({
    title: "New Invoice",
    description: "Create a new invoice",
    canonical: "/dashboard/sales/invoices/new",
  });
}

export default function NewInvoicePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Invoice</h1>
        <p className="text-muted-foreground">
          Create a new invoice for a customer
        </p>
      </div>
      <InvoiceForm mode="create" />
    </div>
  );
}

