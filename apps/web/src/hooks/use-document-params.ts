"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

export type DocumentView = "grid" | "list";

export function useDocumentParams() {
	const [params, setParams] = useQueryStates({
		documentId: parseAsString,
		filePath: parseAsString,
		view: parseAsStringLiteral(["grid", "list"] as const).withDefault("grid"),
	});

	return {
		params,
		setParams,
	};
}

