"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

export const inboxParamsSchema = {
  inboxId: parseAsString,
  order: parseAsStringLiteral(["asc", "desc"] as const).withDefault("asc"),
  sort: parseAsStringLiteral(["date", "name"] as const).withDefault("date"),
  status: parseAsStringLiteral(["done", "pending", "suggested_match", "no_match"] as const),
};

export function useInboxParams() {
  const [params, setParams] = useQueryStates(inboxParamsSchema);

  return {
    params,
    setParams,
  };
}
