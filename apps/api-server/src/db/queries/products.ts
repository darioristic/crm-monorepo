import type {
  Product,
  ProductCategory,
  ProductWithCategory,
  ProductCategoryWithChildren,
  CreateProductRequest,
  UpdateProductRequest,
  CreateProductCategoryRequest,
  UpdateProductCategoryRequest,
  PaginationParams,
} from "@crm/types";
import { generateUUID, now } from "@crm/utils";
import { sql as db } from "../client";
import { createQueryBuilder, type QueryParam } from "../query-builder";

// ============================================
// Product Category Queries
// ============================================

export const productCategoryQueries = {
  async findAll(
    pagination: PaginationParams = {},
    filters: { search?: string; parentId?: string; isActive?: boolean } = {}
  ): Promise<{ categories: ProductCategoryWithChildren[]; total: number }> {
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 50;

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const safeOffset = (safePage - 1) * safePageSize;

    // Gradi parameterizovan upit
    const qb = createQueryBuilder("product_categories");
    qb.addSearchCondition(["name", "description"], filters.search);
    qb.addBooleanCondition("is_active", filters.isActive);

    // Handle parentId specially (null check)
    if (filters.parentId !== undefined) {
      if (filters.parentId === null || filters.parentId === "") {
        // Can't use query builder for IS NULL, handle separately
      } else {
        qb.addUuidCondition("parent_id", filters.parentId);
      }
    }

    const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

    // Add IS NULL condition if needed
    let finalWhereClause = whereClause;
    if (filters.parentId === null || filters.parentId === "") {
      if (finalWhereClause) {
        finalWhereClause += " AND parent_id IS NULL";
      } else {
        finalWhereClause = "WHERE parent_id IS NULL";
      }
    }

    const countQuery = `SELECT COUNT(*) as total FROM product_categories ${finalWhereClause}`;
    const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
    const total = Number(countResult[0]?.total || 0);

    const selectQuery = `
      SELECT 
        id, name, description, parent_id as "parentId",
        sort_order as "sortOrder", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM product_categories
      ${finalWhereClause}
      ORDER BY sort_order ASC, name ASC
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

    const categories = await db.unsafe(selectQuery, [...whereValues, safePageSize, safeOffset] as QueryParam[]);

    // Get product counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat: Record<string, unknown>) => {
        const countRes = await db`
          SELECT COUNT(*) as count FROM products WHERE category_id = ${cat.id as string}
        `;
        return {
          ...cat,
          productCount: Number(countRes[0]?.count || 0),
        } as ProductCategoryWithChildren;
      })
    );

    return { categories: categoriesWithCounts, total };
  },

  async findById(id: string): Promise<ProductCategoryWithChildren | null> {
    const result = await db`
      SELECT 
        id, name, description, parent_id as "parentId",
        sort_order as "sortOrder", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM product_categories
      WHERE id = ${id}
    `;

    if (!result[0]) return null;

    // Get children
    const children = await db`
      SELECT 
        id, name, description, parent_id as "parentId",
        sort_order as "sortOrder", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM product_categories
      WHERE parent_id = ${id}
      ORDER BY sort_order ASC, name ASC
    `;

    // Get product count
    const countRes = await db`
      SELECT COUNT(*) as count FROM products WHERE category_id = ${id}
    `;

    return {
      ...(result[0] as unknown as ProductCategory),
      children: children as unknown as ProductCategory[],
      productCount: Number(countRes[0]?.count || 0),
    };
  },

  async create(data: CreateProductCategoryRequest): Promise<ProductCategory> {
    const id = generateUUID();
    const timestamp = now();

    // Get max sort order for this parent
    const maxOrder = await db`
      SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
      FROM product_categories
      WHERE parent_id ${data.parentId ? db`= ${data.parentId}` : db`IS NULL`}
    `;

    const result = await db`
      INSERT INTO product_categories (
        id, name, description, parent_id, sort_order, is_active, created_at, updated_at
      ) VALUES (
        ${id}, ${data.name}, ${data.description || null}, ${data.parentId || null},
        ${maxOrder[0]?.next_order || 0}, ${data.isActive ?? true}, ${timestamp}, ${timestamp}
      )
      RETURNING 
        id, name, description, parent_id as "parentId",
        sort_order as "sortOrder", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    return result[0] as ProductCategory;
  },

  async update(id: string, data: UpdateProductCategoryRequest): Promise<ProductCategory | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const result = await db`
      UPDATE product_categories SET
        name = COALESCE(${data.name ?? null}, name),
        description = COALESCE(${data.description ?? null}, description),
        parent_id = COALESCE(${data.parentId ?? null}, parent_id),
        is_active = COALESCE(${data.isActive ?? null}, is_active),
        updated_at = ${now()}
      WHERE id = ${id}
      RETURNING 
        id, name, description, parent_id as "parentId",
        sort_order as "sortOrder", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    return (result[0] as ProductCategory) || null;
  },

  async delete(id: string): Promise<boolean> {
    // First, set products in this category to null
    await db`UPDATE products SET category_id = NULL WHERE category_id = ${id}`;

    // Set children to no parent
    await db`UPDATE product_categories SET parent_id = NULL WHERE parent_id = ${id}`;

    const result = await db`
      DELETE FROM product_categories WHERE id = ${id}
    `;

    return result.count > 0;
  },
};

// ============================================
// Product Queries
// ============================================

export const productQueries = {
  async findAll(
    pagination: PaginationParams = {},
    filters: {
      search?: string;
      categoryId?: string;
      isActive?: boolean;
      isService?: boolean;
      minPrice?: number;
      maxPrice?: number;
    } = {}
  ): Promise<{ products: ProductWithCategory[]; total: number }> {
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 20;

    const safePage = Math.max(1, Math.floor(page));
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const safeOffset = (safePage - 1) * safePageSize;

    // Gradi parameterizovan upit
    const qb = createQueryBuilder("products");
    qb.addSearchCondition(["p.name", "p.sku", "p.description"], filters.search);
    qb.addUuidCondition("p.category_id", filters.categoryId);
    qb.addBooleanCondition("p.is_active", filters.isActive);
    qb.addBooleanCondition("p.is_service", filters.isService);
    qb.addRangeCondition("p.unit_price", filters.minPrice, filters.maxPrice);

    const { clause: whereClause, values: whereValues } = qb.buildWhereClause();

    const countQuery = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
    const countResult = await db.unsafe(countQuery, whereValues as QueryParam[]);
    const total = Number(countResult[0]?.total || 0);

    const selectQuery = `
      SELECT 
        p.id, p.name, p.sku, p.description,
        p.unit_price as "unitPrice", p.cost_price as "costPrice",
        p.currency, p.unit, p.tax_rate as "taxRate",
        p.category_id as "categoryId",
        p.stock_quantity as "stockQuantity",
        p.min_stock_level as "minStockLevel",
        p.is_active as "isActive", p.is_service as "isService",
        p.metadata, p.created_at as "createdAt", p.updated_at as "updatedAt",
        c.name as "categoryName"
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT $${whereValues.length + 1} OFFSET $${whereValues.length + 2}
    `;

    const products = await db.unsafe(selectQuery, [...whereValues, safePageSize, safeOffset] as QueryParam[]);

    // Map category info
    const productsWithCategory = products.map((p: Record<string, unknown>) => {
      const { categoryName, ...product } = p as unknown as ProductWithCategory & { categoryName?: string };
      return {
        ...product,
        category: categoryName
          ? ({ id: product.categoryId!, name: categoryName } as ProductCategory)
          : undefined,
      };
    });

    return { products: productsWithCategory, total };
  },

  async findById(id: string): Promise<ProductWithCategory | null> {
    const result = await db`
      SELECT 
        p.id, p.name, p.sku, p.description,
        p.unit_price as "unitPrice", p.cost_price as "costPrice",
        p.currency, p.unit, p.tax_rate as "taxRate",
        p.category_id as "categoryId",
        p.stock_quantity as "stockQuantity",
        p.min_stock_level as "minStockLevel",
        p.is_active as "isActive", p.is_service as "isService",
        p.metadata, p.created_at as "createdAt", p.updated_at as "updatedAt",
        c.name as "categoryName", c.description as "categoryDescription"
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.id = ${id}
    `;

    if (!result[0]) return null;

    const row = result[0] as Record<string, unknown>;
    const categoryName = row.categoryName as string | undefined;
    return {
      id: row.id as string,
      name: row.name as string,
      sku: row.sku as string | undefined,
      description: row.description as string | undefined,
      unitPrice: typeof row.unitPrice === "string" ? parseFloat(row.unitPrice) : (row.unitPrice as number),
      costPrice: row.costPrice !== null ? (typeof row.costPrice === "string" ? parseFloat(row.costPrice as string) : (row.costPrice as number)) : undefined,
      currency: row.currency as string,
      unit: row.unit as string,
      taxRate: typeof row.taxRate === "string" ? parseFloat(row.taxRate) : (row.taxRate as number),
      categoryId: row.categoryId as string | undefined,
      stockQuantity: row.stockQuantity !== null ? Number(row.stockQuantity) : undefined,
      minStockLevel: row.minStockLevel !== null ? Number(row.minStockLevel) : undefined,
      isActive: row.isActive as boolean,
      isService: row.isService as boolean,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt as string),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt as string),
      category: categoryName
        ? ({ id: row.categoryId as string, name: categoryName } as ProductCategory)
        : undefined,
    };
  },

  async findBySku(sku: string): Promise<Product | null> {
    const result = await db`
      SELECT 
        id, name, sku, description,
        unit_price as "unitPrice", cost_price as "costPrice",
        currency, unit, tax_rate as "taxRate",
        category_id as "categoryId",
        stock_quantity as "stockQuantity",
        min_stock_level as "minStockLevel",
        is_active as "isActive", is_service as "isService",
        metadata, created_at as "createdAt", updated_at as "updatedAt"
      FROM products
      WHERE sku = ${sku}
    `;

    return (result[0] as Product) || null;
  },

  async create(data: CreateProductRequest): Promise<Product> {
    const id = generateUUID();
    const timestamp = now();

    const result = await db`
      INSERT INTO products (
        id, name, sku, description, unit_price, cost_price,
        currency, unit, tax_rate, category_id,
        stock_quantity, min_stock_level, is_active, is_service,
        metadata, created_at, updated_at
      ) VALUES (
        ${id}, ${data.name}, ${data.sku || null}, ${data.description || null},
        ${data.unitPrice}, ${data.costPrice || null},
        ${data.currency || "EUR"}, ${data.unit || "pcs"}, ${data.taxRate || 0},
        ${data.categoryId || null},
        ${data.stockQuantity || null}, ${data.minStockLevel || null},
        ${data.isActive ?? true}, ${data.isService ?? false},
        ${data.metadata ? JSON.stringify(data.metadata) : null},
        ${timestamp}, ${timestamp}
      )
      RETURNING 
        id, name, sku, description,
        unit_price as "unitPrice", cost_price as "costPrice",
        currency, unit, tax_rate as "taxRate",
        category_id as "categoryId",
        stock_quantity as "stockQuantity",
        min_stock_level as "minStockLevel",
        is_active as "isActive", is_service as "isService",
        metadata, created_at as "createdAt", updated_at as "updatedAt"
    `;

    return result[0] as Product;
  },

  async update(id: string, data: UpdateProductRequest): Promise<Product | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const result = await db`
      UPDATE products SET
        name = COALESCE(${data.name ?? null}, name),
        sku = COALESCE(${data.sku ?? null}, sku),
        description = COALESCE(${data.description ?? null}, description),
        unit_price = COALESCE(${data.unitPrice ?? null}, unit_price),
        cost_price = COALESCE(${data.costPrice ?? null}, cost_price),
        currency = COALESCE(${data.currency ?? null}, currency),
        unit = COALESCE(${data.unit ?? null}, unit),
        tax_rate = COALESCE(${data.taxRate ?? null}, tax_rate),
        category_id = COALESCE(${data.categoryId ?? null}, category_id),
        stock_quantity = COALESCE(${data.stockQuantity ?? null}, stock_quantity),
        min_stock_level = COALESCE(${data.minStockLevel ?? null}, min_stock_level),
        is_active = COALESCE(${data.isActive ?? null}, is_active),
        is_service = COALESCE(${data.isService ?? null}, is_service),
        metadata = COALESCE(${data.metadata ? JSON.stringify(data.metadata) : null}, metadata),
        updated_at = ${now()}
      WHERE id = ${id}
      RETURNING 
        id, name, sku, description,
        unit_price as "unitPrice", cost_price as "costPrice",
        currency, unit, tax_rate as "taxRate",
        category_id as "categoryId",
        stock_quantity as "stockQuantity",
        min_stock_level as "minStockLevel",
        is_active as "isActive", is_service as "isService",
        metadata, created_at as "createdAt", updated_at as "updatedAt"
    `;

    return (result[0] as Product) || null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await db`
      DELETE FROM products WHERE id = ${id}
    `;

    return result.count > 0;
  },

  async updateStock(id: string, quantity: number): Promise<Product | null> {
    const result = await db`
      UPDATE products SET
        stock_quantity = ${quantity},
        updated_at = ${now()}
      WHERE id = ${id}
      RETURNING 
        id, name, sku, description,
        unit_price as "unitPrice", cost_price as "costPrice",
        currency, unit, tax_rate as "taxRate",
        category_id as "categoryId",
        stock_quantity as "stockQuantity",
        min_stock_level as "minStockLevel",
        is_active as "isActive", is_service as "isService",
        metadata, created_at as "createdAt", updated_at as "updatedAt"
    `;

    return (result[0] as Product) || null;
  },

  async getLowStockProducts(): Promise<Product[]> {
    return db<Product[]>`
      SELECT 
        id, name, sku, description,
        unit_price as "unitPrice", cost_price as "costPrice",
        currency, unit, tax_rate as "taxRate",
        category_id as "categoryId",
        stock_quantity as "stockQuantity",
        min_stock_level as "minStockLevel",
        is_active as "isActive", is_service as "isService",
        metadata, created_at as "createdAt", updated_at as "updatedAt"
      FROM products
      WHERE is_active = true 
        AND is_service = false 
        AND stock_quantity IS NOT NULL 
        AND min_stock_level IS NOT NULL
        AND stock_quantity <= min_stock_level
      ORDER BY (stock_quantity / NULLIF(min_stock_level, 0)) ASC
    `;
  },
};

export default { productCategoryQueries, productQueries };
