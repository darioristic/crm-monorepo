import type { Category } from "./types";

// Default expense categories
export const EXPENSE_CATEGORIES: Category[] = [
  { id: "office", name: "Office Supplies", slug: "office-supplies", color: "#3B82F6" },
  { id: "software", name: "Software & Tools", slug: "software-tools", color: "#8B5CF6" },
  { id: "travel", name: "Travel & Transportation", slug: "travel", color: "#10B981" },
  { id: "meals", name: "Meals & Entertainment", slug: "meals-entertainment", color: "#F59E0B" },
  { id: "utilities", name: "Utilities", slug: "utilities", color: "#6366F1" },
  { id: "rent", name: "Rent & Lease", slug: "rent-lease", color: "#EC4899" },
  { id: "marketing", name: "Marketing & Advertising", slug: "marketing", color: "#14B8A6" },
  {
    id: "professional",
    name: "Professional Services",
    slug: "professional-services",
    color: "#F97316",
  },
  { id: "insurance", name: "Insurance", slug: "insurance", color: "#8B5CF6" },
  { id: "taxes", name: "Taxes & Fees", slug: "taxes-fees", color: "#EF4444" },
  { id: "equipment", name: "Equipment & Hardware", slug: "equipment", color: "#06B6D4" },
  { id: "payroll", name: "Payroll & Benefits", slug: "payroll", color: "#84CC16" },
  { id: "other", name: "Other Expenses", slug: "other", color: "#6B7280" },
];

// Default income categories
export const INCOME_CATEGORIES: Category[] = [
  { id: "sales", name: "Product Sales", slug: "product-sales", color: "#10B981" },
  { id: "services", name: "Service Revenue", slug: "service-revenue", color: "#3B82F6" },
  { id: "consulting", name: "Consulting", slug: "consulting", color: "#8B5CF6" },
  { id: "subscriptions", name: "Subscriptions", slug: "subscriptions", color: "#F59E0B" },
  { id: "interest", name: "Interest Income", slug: "interest", color: "#6366F1" },
  { id: "refunds", name: "Refunds & Returns", slug: "refunds", color: "#EC4899" },
  { id: "other_income", name: "Other Income", slug: "other-income", color: "#6B7280" },
];

// All categories combined
export const ALL_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

// Category lookup helpers
export function getCategoryById(id: string): Category | undefined {
  return ALL_CATEGORIES.find((c) => c.id === id);
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return ALL_CATEGORIES.find((c) => c.slug === slug);
}

export function getCategoryByName(name: string): Category | undefined {
  return ALL_CATEGORIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export function getExpenseCategories(): Category[] {
  return EXPENSE_CATEGORIES;
}

export function getIncomeCategories(): Category[] {
  return INCOME_CATEGORIES;
}
