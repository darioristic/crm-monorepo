import { generateMeta } from "@/lib/utils";
import { QuoteForm } from "@/components/sales/quote-form";

export async function generateMetadata() {
  return generateMeta({
    title: "New Quote",
    description: "Create a new sales quote",
    canonical: "/dashboard/sales/quotes/new",
  });
}

export default function NewQuotePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Quote</h1>
        <p className="text-muted-foreground">
          Create a new sales quote for a customer
        </p>
      </div>
      <QuoteForm mode="create" />
    </div>
  );
}

