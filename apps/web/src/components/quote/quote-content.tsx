"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { QuoteDefaultSettings, QuoteFormValues } from "@/types/quote";
import { Form } from "./form";
import { FormContext } from "./form-context";
import { SettingsMenu } from "./settings-menu";

type QuoteContentProps = {
  type: "create" | "edit" | "success";
  quoteId?: string;
  data?: Partial<QuoteFormValues>;
  defaultSettings?: Partial<QuoteDefaultSettings>;
  onClose?: () => void;
};

export function QuoteContent({ type, quoteId, data, defaultSettings, onClose }: QuoteContentProps) {
  const router = useRouter();

  const handleSuccess = (id: string) => {
    router.push(`/dashboard/sales/quotes/${id}`);
    onClose?.();
  };

  const handleBack = () => {
    onClose?.();
  };

  if (type === "success") {
    return (
      <SuccessContent
        quoteId={quoteId!}
        onViewQuote={() => router.push(`/dashboard/sales/quotes/${quoteId}`)}
        onCreateAnother={() => {
          router.push(`/dashboard/sales/quotes?type=create`);
          onClose?.();
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <FormContext key={`${type}-${quoteId || "new"}`} data={data} defaultSettings={defaultSettings}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">
              {type === "edit" ? "Edit Quote" : "Create Quote"}
            </h2>
          </div>
          <SettingsMenu />
        </div>

        {/* Form */}
        <div className="flex-1 overflow-visible">
          <Form quoteId={quoteId} onSuccess={handleSuccess} />
        </div>
      </div>
    </FormContext>
  );
}

type SuccessContentProps = {
  quoteId: string;
  onViewQuote: () => void;
  onCreateAnother: () => void;
  onClose?: () => void;
};

function SuccessContent({ quoteId, onViewQuote, onCreateAnother, onClose }: SuccessContentProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
        <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>

      <h2 className="text-2xl font-semibold mb-2">Quote Created</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Your quote has been created successfully. You can now view it, send it to your customer, or
        create another one.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCreateAnother}>
          Create Another
        </Button>
        <Button onClick={onViewQuote}>View Quote</Button>
      </div>
    </div>
  );
}
