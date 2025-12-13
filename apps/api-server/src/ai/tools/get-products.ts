import { tool } from "ai";
import { z } from "zod";
import { sql as db } from "../../db/client";

const getProductsSchema = z.object({
  pageSize: z.number().min(1).max(50).optional().describe("Number of products to return"),
  search: z.string().optional().describe("Search by product name or SKU"),
  category: z.string().optional().describe("Filter by category"),
});

type GetProductsParams = z.infer<typeof getProductsSchema>;

export const getProductsTool = tool({
  description: "Search and retrieve products with filtering options",
  inputSchema: getProductsSchema,
  execute: async (input: GetProductsParams): Promise<string> => {
    const { pageSize = 10, search, category } = input;
    try {
      let query = `
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN product_categories c ON p.category_id = c.id
        WHERE 1=1
      `;
      const queryParams: (string | number)[] = [];

      if (search) {
        queryParams.push(`%${search}%`);
        query += ` AND (p.name ILIKE $${queryParams.length} OR p.sku ILIKE $${queryParams.length})`;
      }

      if (category) {
        queryParams.push(category);
        query += ` AND c.name = $${queryParams.length}`;
      }

      queryParams.push(pageSize);
      query += ` ORDER BY p.name ASC LIMIT $${queryParams.length}`;

      const result = await db.unsafe(query, queryParams as (string | number)[]);

      if (result.length === 0) {
        return "No products found matching your criteria.";
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("sr-RS", {
          style: "currency",
          currency: "EUR",
        }).format(amount);
      };

      const tableRows = result
        .map((product: Record<string, unknown>) => {
          const price = formatCurrency(parseFloat(product.price as string) || 0);
          return `| ${product.name} | ${product.sku || "N/A"} | ${product.category_name || "Uncategorized"} | ${price} |`;
        })
        .join("\n");

      return `| Product Name | SKU | Category | Price |
|--------------|-----|----------|-------|
${tableRows}

**Found ${result.length} products**`;
    } catch (error) {
      return `Failed to retrieve products: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

const emptySchema = z.object({});

export const getProductCategoriesSummaryTool = tool({
  description: "Get a summary of products grouped by category",
  inputSchema: emptySchema,
  execute: async (): Promise<string> => {
    try {
      const result = await db`
        SELECT
          COALESCE(c.name, 'Uncategorized') as category,
          COUNT(p.id) as product_count,
          AVG(p.price) as avg_price
        FROM products p
        LEFT JOIN product_categories c ON p.category_id = c.id
        GROUP BY c.name
        ORDER BY product_count DESC
      `;

      if (result.length === 0) {
        return "No product categories found.";
      }

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("sr-RS", {
          style: "currency",
          currency: "EUR",
        }).format(amount);
      };

      const tableRows = result
        .map((row: Record<string, unknown>) => {
          const avgPrice = formatCurrency(parseFloat(row.avg_price as string) || 0);
          return `| ${row.category} | ${row.product_count} | ${avgPrice} |`;
        })
        .join("\n");

      const totalProducts = result.reduce(
        (sum: number, row: Record<string, unknown>) =>
          sum + parseInt(row.product_count as string, 10),
        0
      );

      return `**Product Categories Overview**

| Category | Products | Avg. Price |
|----------|----------|------------|
${tableRows}

**Total Products**: ${totalProducts}`;
    } catch (error) {
      return `Failed to retrieve categories: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
