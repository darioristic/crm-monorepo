import Link from "next/link";
import { FileX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvoiceNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
          <FileX className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-2xl font-semibold mb-2">Invoice Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The invoice you're looking for doesn't exist or has been removed.
          Please check the link and try again.
        </p>

        <Button asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}

