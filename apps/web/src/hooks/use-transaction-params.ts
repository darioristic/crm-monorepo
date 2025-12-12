"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

export type TransactionView = "table" | "grid";

export function useTransactionParams() {
  const [params, setParams] = useQueryStates({
    transactionId: parseAsString,
    view: parseAsStringLiteral(["table", "grid"] as const).withDefault("table"),
    category: parseAsString,
    tag: parseAsString,
  });

  return {
    transactionId: params.transactionId,
    view: params.view,
    category: params.category,
    tag: params.tag,
    setParams,
    setTransactionId: (id: string | null) => setParams({ transactionId: id }),
  };
}
