"use client";

import type { Deal, DealStage } from "@crm/types";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { Calendar, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanItem,
  KanbanOverlay,
} from "@/components/ui/kanban";
import { Skeleton } from "@/components/ui/skeleton";
import { dealsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { DealFormSheet } from "./deal-form-sheet";

type Props = {
  deals: Deal[];
  isLoading?: boolean;
  error?: string;
  onRefresh: () => void;
};

type StageInfo = {
  id: DealStage;
  label: string;
};

const STAGES: StageInfo[] = [
  { id: "discovery", label: "Discovery" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed_won", label: "Closed Won" },
  { id: "closed_lost", label: "Closed Lost" },
];

const COLUMNS = STAGES.reduce(
  (acc, stage) => {
    acc[stage.id] = { id: stage.id, title: stage.label };
    return acc;
  },
  {} as Record<DealStage, { id: DealStage; title: string }>
);

const priorityColors = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
} as const;

const stageColors: Record<DealStage, string> = {
  discovery: "bg-blue-500/10 border-blue-500/20",
  proposal: "bg-yellow-500/10 border-yellow-500/20",
  negotiation: "bg-orange-500/10 border-orange-500/20",
  closed_won: "bg-green-500/10 border-green-500/20",
  closed_lost: "bg-red-500/10 border-red-500/20",
};

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

type KanbanColumns = Record<DealStage, Deal[]>;

function DealCard({
  deal,
  onEdit,
  onDelete,
}: {
  deal: Deal;
  onEdit: (deal: Deal) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="cursor-grab active:cursor-grabbing">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <p className="font-medium text-sm truncate flex-1">{deal.title}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(deal)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(deal.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {deal.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{deal.description}</p>
            )}

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-sm font-semibold">
                {formatCurrency(deal.value, deal.currency)}
              </span>
              <Badge variant={priorityColors[deal.priority]} className="text-xs capitalize">
                {deal.priority}
              </Badge>
            </div>

            <div className="flex items-center justify-between mt-2">
              {deal.expectedCloseDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(deal.expectedCloseDate)}
                </span>
              )}
              <div className="flex items-center gap-1">
                <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${deal.probability}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{deal.probability}%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DealsKanban({ deals, isLoading, error, onRefresh }: Props) {
  const [columns, setColumns] = useState<KanbanColumns>({
    discovery: [],
    proposal: [],
    negotiation: [],
    closed_won: [],
    closed_lost: [],
  });
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [newDealStage, setNewDealStage] = useState<DealStage | null>(null);

  // Organize deals into columns
  useEffect(() => {
    if (deals) {
      const organized: KanbanColumns = {
        discovery: [],
        proposal: [],
        negotiation: [],
        closed_won: [],
        closed_lost: [],
      };

      deals.forEach((deal) => {
        if (organized[deal.stage]) {
          organized[deal.stage].push(deal);
        }
      });

      setColumns(organized);
    }
  }, [deals]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this deal?")) return;
    try {
      await dealsApi.delete(id);
      toast.success("Deal deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete deal");
    }
  };

  const handleValueChange = useCallback(
    async (newColumns: KanbanColumns) => {
      const previousColumns = columns;

      // Find deal that changed columns
      for (const [stage, dealList] of Object.entries(newColumns)) {
        for (const deal of dealList) {
          const previousStage = Object.entries(previousColumns).find(([_, deals]) =>
            deals.some((d) => d.id === deal.id)
          )?.[0] as DealStage | undefined;

          if (previousStage && previousStage !== stage) {
            // Deal moved to a new column - update on backend
            try {
              const result = await dealsApi.update(deal.id, { stage: stage as DealStage });

              if (!result.success) {
                toast.error("Failed to update deal stage");
                setColumns(previousColumns);
                return;
              }

              toast.success(`Deal moved to ${COLUMNS[stage as DealStage].title}`);
            } catch {
              toast.error("Failed to update deal stage");
              setColumns(previousColumns);
              return;
            }
          }
        }
      }

      setColumns(newColumns);
    },
    [columns]
  );

  const getItemValue = useCallback((deal: Deal): UniqueIdentifier => deal.id, []);

  // Calculate totals per column
  const columnTotals = useMemo(() => {
    const totals: Record<DealStage, { count: number; value: number }> = {
      discovery: { count: 0, value: 0 },
      proposal: { count: 0, value: 0 },
      negotiation: { count: 0, value: 0 },
      closed_won: { count: 0, value: 0 },
      closed_lost: { count: 0, value: 0 },
    };

    for (const [stage, deals] of Object.entries(columns)) {
      totals[stage as DealStage] = {
        count: deals.length,
        value: deals.reduce((sum, d) => sum + d.value, 0),
      };
    }

    return totals;
  }, [columns]);

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div key={stage.id} className="w-[300px] flex-shrink-0">
            <Skeleton className="h-[600px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Error loading deals: {error}</p>
        <Button variant="outline" className="mt-4" onClick={onRefresh}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <Kanban value={columns} onValueChange={handleValueChange} getItemValue={getItemValue}>
          <KanbanBoard className="min-w-max">
            {STAGES.map((stage) => (
              <KanbanColumn
                key={stage.id}
                value={stage.id}
                className={`w-[300px] ${stageColors[stage.id]} border`}
              >
                <Card className="border-0 shadow-none bg-transparent">
                  <CardHeader className="pb-2 px-2 pt-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span>{stage.label}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {columnTotals[stage.id].count}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-normal">
                          {formatCurrency(columnTotals[stage.id].value, "EUR")}
                        </span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-2 min-h-[500px]">
                    {columns[stage.id]?.map((deal) => (
                      <KanbanItem key={deal.id} value={deal.id} asHandle>
                        <DealCard deal={deal} onEdit={setEditingDeal} onDelete={handleDelete} />
                      </KanbanItem>
                    ))}
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => setNewDealStage(stage.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Deal
                    </Button>
                  </CardContent>
                </Card>
              </KanbanColumn>
            ))}
          </KanbanBoard>
          <KanbanOverlay>
            {({ value }) => {
              const deal = Object.values(columns)
                .flat()
                .find((d) => d.id === value);
              if (!deal) return null;
              return <DealCard deal={deal} onEdit={() => {}} onDelete={() => {}} />;
            }}
          </KanbanOverlay>
        </Kanban>
      </div>

      <DealFormSheet
        open={!!editingDeal}
        onOpenChange={(open) => !open && setEditingDeal(null)}
        deal={editingDeal || undefined}
        onSaved={() => {
          setEditingDeal(null);
          onRefresh();
        }}
      />

      <DealFormSheet
        open={!!newDealStage}
        onOpenChange={(open) => !open && setNewDealStage(null)}
        defaultStage={newDealStage || undefined}
        onSaved={() => {
          setNewDealStage(null);
          onRefresh();
        }}
      />
    </>
  );
}
