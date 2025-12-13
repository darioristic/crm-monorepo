"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Filter, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type InboxItem, inboxApi } from "@/lib/api/inbox";
import { formatCurrency } from "@/lib/utils";

type Props = {
  data: InboxItem;
};

export function InboxActions({ data }: Props) {
  return (
    <AnimatePresence>
      {data?.status === "suggested_match" && !data?.transactionId && data?.suggestion && (
        <SuggestedMatch key="suggested-match" data={data} />
      )}

      {!data?.suggestion && <MatchTransaction key="match-transaction" />}
    </AnimatePresence>
  );
}

function SuggestedMatch({ data }: Props) {
  const queryClient = useQueryClient();

  const confirmMatchMutation = useMutation({
    mutationFn: () =>
      inboxApi.confirmMatch(data.id, data.suggestion!.transactionId, data.suggestion!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });
      toast.success("Match confirmed");
    },
    onError: () => {
      toast.error("Failed to confirm match");
    },
  });

  const declineMatchMutation = useMutation({
    mutationFn: () => inboxApi.declineMatch(data.id, data.suggestion!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-stats"] });
      toast.success("Match declined");
    },
    onError: () => {
      toast.error("Failed to decline match");
    },
  });

  const suggestion = data.suggestion;

  return (
    <motion.div
      key="suggested-match"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="bg-white/95 dark:bg-black/95 p-4 space-y-4 border dark:border-[#2C2C2C] border-[#DCDAD2] shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <span className="truncate font-medium">{data.displayName || "Suggested Match"}</span>
            <span className="text-muted-foreground text-xs">{suggestion?.matchType}</span>
          </div>

          <div className="text-xs text-muted-foreground">
            {suggestion && Math.round(suggestion.confidenceScore * 100)}% confidence
          </div>
        </div>

        {data.amount && (
          <span className="font-medium">{formatCurrency(data.amount, data.currency || "EUR")}</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => declineMatchMutation.mutate()}
          variant="outline"
          size="sm"
          disabled={declineMatchMutation.isPending}
          className="w-full"
        >
          Decline
        </Button>
        <Button
          onClick={() => confirmMatchMutation.mutate()}
          size="sm"
          disabled={confirmMatchMutation.isPending}
          className="w-full"
        >
          Confirm
        </Button>
      </div>
    </motion.div>
  );
}

function MatchTransaction() {
  const [searchValue, setSearchValue] = useState("");

  return (
    <motion.div
      key="match-transaction"
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="bg-background h-12 relative"
    >
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="Select a transaction"
        className="w-full bg-transparent px-12 h-12 border border-border"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
      />

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10 h-6 w-6 text-muted-foreground hover:text-muted-foreground"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs px-3 py-1.5">Filter transactions</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
}
