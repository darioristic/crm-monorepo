"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "./form";
import { SettingsMenu } from "./settings-menu";
import { FormContext } from "./form-context";
import type { OrderFormValues, OrderDefaultSettings } from "@/types/order";

type OrderContentProps = {
  type: "create" | "edit" | "success";
  orderId?: string;
  data?: Partial<OrderFormValues>;
  defaultSettings?: Partial<OrderDefaultSettings>;
  onClose?: () => void;
};

export function OrderContent({
  type,
  orderId,
  data,
  defaultSettings,
  onClose,
}: OrderContentProps) {
  const router = useRouter();

  const handleSuccess = (id: string) => {
    router.push(`/dashboard/sales/orders/${id}`);
    onClose?.();
  };

  const handleBack = () => {
    onClose?.();
  };

  if (type === "success") {
    return (
      <SuccessContent
        orderId={orderId!}
        onViewOrder={() => router.push(`/dashboard/sales/orders/${orderId}`)}
        onCreateAnother={() => window.location.reload()}
        onClose={onClose}
      />
    );
  }

  return (
    <FormContext data={data} defaultSettings={defaultSettings}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">
              {type === "edit" ? "Edit Order" : "Create Order"}
            </h2>
          </div>
          <SettingsMenu />
        </div>

        {/* Form */}
        <div className="flex-1 overflow-visible">
          <Form orderId={orderId} onSuccess={handleSuccess} />
        </div>
      </div>
    </FormContext>
  );
}

type SuccessContentProps = {
  orderId: string;
  onViewOrder: () => void;
  onCreateAnother: () => void;
  onClose?: () => void;
};

function SuccessContent({
  orderId,
  onViewOrder,
  onCreateAnother,
  onClose,
}: SuccessContentProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
        <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>

      <h2 className="text-2xl font-semibold mb-2">Order Created</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        Your order has been created successfully. You can now view it, send it
        to your customer, or create another one.
      </p>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCreateAnother}>
          Create Another
        </Button>
        <Button onClick={onViewOrder}>View Order</Button>
      </div>
    </div>
  );
}

