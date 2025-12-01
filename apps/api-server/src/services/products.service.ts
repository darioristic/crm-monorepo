import type {
	Product,
	ProductCategory,
	ProductWithCategory,
	ProductCategoryWithChildren,
	CreateProductRequest,
	UpdateProductRequest,
	CreateProductCategoryRequest,
	UpdateProductCategoryRequest,
	ApiResponse,
	PaginationParams,
} from "@crm/types";
import { successResponse, errorResponse, paginatedResponse } from "@crm/utils";
import { productQueries, productCategoryQueries } from "../db/queries/products";

// ============================================
// Product Category Service
// ============================================

class ProductCategoryService {
	async getCategories(
		pagination: PaginationParams = {},
		filters: { search?: string; parentId?: string; isActive?: boolean } = {},
	): Promise<ApiResponse<ProductCategoryWithChildren[]>> {
		try {
			const { categories, total } = await productCategoryQueries.findAll(
				pagination,
				filters,
			);
			return paginatedResponse(categories, total, pagination);
		} catch (error) {
			console.error("Error fetching categories:", error);
			return errorResponse("SERVER_ERROR", "Failed to fetch categories");
		}
	}

	async getCategoryById(
		id: string,
	): Promise<ApiResponse<ProductCategoryWithChildren>> {
		try {
			const category = await productCategoryQueries.findById(id);
			if (!category) {
				return errorResponse("NOT_FOUND", "Category not found");
			}
			return successResponse(category);
		} catch (error) {
			console.error("Error fetching category:", error);
			return errorResponse("SERVER_ERROR", "Failed to fetch category");
		}
	}

	async createCategory(
		data: CreateProductCategoryRequest,
	): Promise<ApiResponse<ProductCategory>> {
		try {
			if (!data.name || data.name.trim().length === 0) {
				return errorResponse("VALIDATION_ERROR", "Category name is required");
			}

			const category = await productCategoryQueries.create(data);
			return successResponse(category);
		} catch (error) {
			console.error("Error creating category:", error);
			return errorResponse("SERVER_ERROR", "Failed to create category");
		}
	}

	async updateCategory(
		id: string,
		data: UpdateProductCategoryRequest,
	): Promise<ApiResponse<ProductCategory>> {
		try {
			const category = await productCategoryQueries.update(id, data);
			if (!category) {
				return errorResponse("NOT_FOUND", "Category not found");
			}
			return successResponse(category);
		} catch (error) {
			console.error("Error updating category:", error);
			return errorResponse("SERVER_ERROR", "Failed to update category");
		}
	}

	async deleteCategory(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
		try {
			const deleted = await productCategoryQueries.delete(id);
			if (!deleted) {
				return errorResponse("NOT_FOUND", "Category not found");
			}
			return successResponse({ deleted: true });
		} catch (error) {
			console.error("Error deleting category:", error);
			return errorResponse("SERVER_ERROR", "Failed to delete category");
		}
	}
}

// ============================================
// Product Service
// ============================================

class ProductService {
	async getProducts(
		pagination: PaginationParams = {},
		filters: {
			search?: string;
			categoryId?: string;
			isActive?: boolean;
			isService?: boolean;
			minPrice?: number;
			maxPrice?: number;
		} = {},
	): Promise<ApiResponse<ProductWithCategory[]>> {
		try {
			const { products, total } = await productQueries.findAll(
				pagination,
				filters,
			);
			return paginatedResponse(products, total, pagination);
		} catch (error) {
			console.error("Error fetching products:", error);
			return errorResponse("SERVER_ERROR", "Failed to fetch products");
		}
	}

	async getProductById(id: string): Promise<ApiResponse<ProductWithCategory>> {
		try {
			const product = await productQueries.findById(id);
			if (!product) {
				return errorResponse("NOT_FOUND", "Product not found");
			}
			return successResponse(product);
		} catch (error) {
			console.error("Error fetching product:", error);
			return errorResponse("SERVER_ERROR", "Failed to fetch product");
		}
	}

	async getProductBySku(sku: string): Promise<ApiResponse<Product>> {
		try {
			const product = await productQueries.findBySku(sku);
			if (!product) {
				return errorResponse("NOT_FOUND", "Product not found");
			}
			return successResponse(product);
		} catch (error) {
			console.error("Error fetching product by SKU:", error);
			return errorResponse("SERVER_ERROR", "Failed to fetch product");
		}
	}

	async createProduct(
		data: CreateProductRequest,
	): Promise<ApiResponse<Product>> {
		try {
			// Validation
			if (!data.name || data.name.trim().length === 0) {
				return errorResponse("VALIDATION_ERROR", "Product name is required");
			}

			if (data.unitPrice === undefined || data.unitPrice < 0) {
				return errorResponse(
					"VALIDATION_ERROR",
					"Valid unit price is required",
				);
			}

			// Check for duplicate SKU
			if (data.sku) {
				const existing = await productQueries.findBySku(data.sku);
				if (existing) {
					return errorResponse(
						"CONFLICT",
						"A product with this SKU already exists",
					);
				}
			}

			const product = await productQueries.create(data);
			return successResponse(product);
		} catch (error) {
			console.error("Error creating product:", error);
			return errorResponse("SERVER_ERROR", "Failed to create product");
		}
	}

	async updateProduct(
		id: string,
		data: UpdateProductRequest,
	): Promise<ApiResponse<Product>> {
		try {
			// Check for duplicate SKU if updating
			if (data.sku) {
				const existing = await productQueries.findBySku(data.sku);
				if (existing && existing.id !== id) {
					return errorResponse(
						"CONFLICT",
						"A product with this SKU already exists",
					);
				}
			}

			const product = await productQueries.update(id, data);
			if (!product) {
				return errorResponse("NOT_FOUND", "Product not found");
			}
			return successResponse(product);
		} catch (error) {
			console.error("Error updating product:", error);
			return errorResponse("SERVER_ERROR", "Failed to update product");
		}
	}

	async deleteProduct(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
		try {
			const deleted = await productQueries.delete(id);
			if (!deleted) {
				return errorResponse("NOT_FOUND", "Product not found");
			}
			return successResponse({ deleted: true });
		} catch (error) {
			console.error("Error deleting product:", error);
			return errorResponse("SERVER_ERROR", "Failed to delete product");
		}
	}

	async updateStock(
		id: string,
		quantity: number,
	): Promise<ApiResponse<Product>> {
		try {
			if (quantity < 0) {
				return errorResponse(
					"VALIDATION_ERROR",
					"Stock quantity cannot be negative",
				);
			}

			const product = await productQueries.updateStock(id, quantity);
			if (!product) {
				return errorResponse("NOT_FOUND", "Product not found");
			}
			return successResponse(product);
		} catch (error) {
			console.error("Error updating stock:", error);
			return errorResponse("SERVER_ERROR", "Failed to update stock");
		}
	}

	async getLowStockProducts(): Promise<ApiResponse<Product[]>> {
		try {
			const products = await productQueries.getLowStockProducts();
			return successResponse(products);
		} catch (error) {
			console.error("Error fetching low stock products:", error);
			return errorResponse(
				"SERVER_ERROR",
				"Failed to fetch low stock products",
			);
		}
	}

	/**
	 * Get popular products sorted by usage count
	 * Used for smart autocomplete suggestions
	 */
	async getPopularProducts(
		limit = 20,
		currency?: string,
	): Promise<ApiResponse<Product[]>> {
		try {
			const products = await productQueries.getPopularProducts(limit, currency);
			return successResponse(products);
		} catch (error) {
			console.error("Error fetching popular products:", error);
			return errorResponse("SERVER_ERROR", "Failed to fetch popular products");
		}
	}

	/**
	 * Increment usage count when product is selected
	 * Called when user selects a product from autocomplete
	 */
	async incrementUsage(id: string): Promise<ApiResponse<Product>> {
		try {
			const product = await productQueries.incrementUsage(id);
			if (!product) {
				return errorResponse("NOT_FOUND", "Product not found");
			}
			return successResponse(product);
		} catch (error) {
			console.error("Error incrementing product usage:", error);
			return errorResponse("SERVER_ERROR", "Failed to increment product usage");
		}
	}

	/**
	 * Save line item as product (smart learning)
	 * Creates a new product or updates existing based on name/currency/price
	 * Called on blur of product name field in invoice
	 */
	async saveLineItemAsProduct(data: {
		name: string;
		price?: number | null;
		currency?: string | null;
		unit?: string | null;
		productId?: string;
	}): Promise<
		ApiResponse<{ product: Product | null; shouldClearProductId: boolean }>
	> {
		try {
			const result = await productQueries.upsertProduct(data);
			return successResponse(result);
		} catch (error) {
			console.error("Error saving line item as product:", error);
			return errorResponse(
				"SERVER_ERROR",
				"Failed to save line item as product",
			);
		}
	}
}

export const productCategoryService = new ProductCategoryService();
export const productsService = new ProductService();
