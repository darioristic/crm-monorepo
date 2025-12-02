import { format } from "date-fns";

/**
 * Get a human-readable label for the fiscal year start month
 */
export function getFiscalYearLabel(month: number | null): string {
	if (!month) return "Trailing 12 months";

	// Create a date with the target month and format it
	const date = new Date(2024, month - 1, 1);
	return format(date, "MMMM");
}

