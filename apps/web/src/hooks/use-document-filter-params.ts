"use client";

import { useQueryStates } from "nuqs";
import { createLoader, parseAsArrayOf, parseAsBoolean, parseAsString } from "nuqs/server";

export const documentFilterParamsSchema = {
  q: parseAsString,
  tags: parseAsArrayOf(parseAsString),
  start: parseAsString,
  end: parseAsString,
  semantic: parseAsBoolean.withDefault(false),
};

export function useDocumentFilterParams() {
  const [filter, setFilter] = useQueryStates(documentFilterParamsSchema);

  return {
    filter,
    setFilter,
    hasFilters: Object.entries(filter).some(
      ([key, value]) => key !== "semantic" && value !== null && value !== false
    ),
  };
}

export const loadDocumentFilterParams = createLoader(documentFilterParamsSchema);
