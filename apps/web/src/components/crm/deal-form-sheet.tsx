"use client";

import type { CreateDealRequest, Deal, DealStage, UpdateDealRequest } from "@crm/types";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { dealsApi } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal;
  defaultStage?: DealStage;
  onSaved: () => void;
};

const DEAL_STAGES: { value: DealStage; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
];

const DEAL_PRIORITIES: { value: Deal["priority"]; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function DealFormSheet({ open, onOpenChange, deal, defaultStage, onSaved }: Props) {
  const isEditing = !!deal;

  const [formData, setFormData] = useState<Partial<Deal>>({
    title: "",
    description: "",
    value: 0,
    currency: "EUR",
    stage: defaultStage || "discovery",
    priority: "medium",
    probability: 20,
    expectedCloseDate: "",
    assignedTo: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title,
        description: deal.description || "",
        value: deal.value,
        currency: deal.currency,
        stage: deal.stage,
        priority: deal.priority,
        probability: deal.probability,
        expectedCloseDate: deal.expectedCloseDate?.split("T")[0] || "",
        assignedTo: deal.assignedTo,
      });
    } else {
      setFormData({
        title: "",
        description: "",
        value: 0,
        currency: "EUR",
        stage: defaultStage || "discovery",
        priority: "medium",
        probability: 20,
        expectedCloseDate: "",
        assignedTo: "",
      });
    }
    setError(null);
  }, [deal, defaultStage, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && deal) {
        const updateData: UpdateDealRequest = {
          title: formData.title,
          description: formData.description || undefined,
          value: formData.value,
          currency: formData.currency,
          stage: formData.stage,
          priority: formData.priority,
          probability: formData.probability,
          expectedCloseDate: formData.expectedCloseDate || undefined,
        };
        const result = await dealsApi.update(deal.id, updateData);
        if (!result.success) {
          throw new Error(result.error?.message || "Failed to update deal");
        }
      } else {
        const createData: CreateDealRequest = {
          title: formData.title!,
          description: formData.description || undefined,
          value: formData.value!,
          currency: formData.currency || "EUR",
          stage: formData.stage || "discovery",
          priority: formData.priority || "medium",
          probability: formData.probability ?? 20,
          expectedCloseDate: formData.expectedCloseDate || undefined,
          assignedTo: formData.assignedTo || crypto.randomUUID(), // TODO: Get from auth context
        };
        const result = await dealsApi.create(createData);
        if (!result.success) {
          throw new Error(result.error?.message || "Failed to create deal");
        }
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Deal" : "Create Deal"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update the deal information below."
              : "Fill in the details to create a new deal."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Deal Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Enterprise Contract - Acme Corp"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Details about this deal..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Deal Value *</Label>
              <Input
                id="value"
                type="number"
                value={formData.value || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    value: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                placeholder="10000"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="RSD">RSD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stage">Stage</Label>
              <Select
                value={formData.stage}
                onValueChange={(value) => setFormData({ ...formData, stage: value as DealStage })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value as Deal["priority"] })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_PRIORITIES.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="probability">Win Probability (%)</Label>
              <Input
                id="probability"
                type="number"
                value={formData.probability || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    probability: e.target.value ? parseInt(e.target.value, 10) : 0,
                  })
                }
                placeholder="50"
                min="0"
                max="100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
              <Input
                id="expectedCloseDate"
                type="date"
                value={formData.expectedCloseDate}
                onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
              />
            </div>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Update Deal" : "Create Deal"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
