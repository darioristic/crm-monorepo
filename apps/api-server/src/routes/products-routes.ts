/**
 * Product Routes - Products, Categories
 */

import type {
  CreateProductCategoryRequest,
  CreateProductRequest,
  UpdateProductCategoryRequest,
  UpdateProductRequest,
} from "@crm/types";
import { errorResponse } from "@crm/utils";
import { productCategoryService, productsService } from "../services/products.service";
import { parseBody, parseFilters, parsePagination, RouteBuilder, withAuth } from "./helpers";

const router = new RouteBuilder();

// ============================================
// PRODUCT CATEGORIES
// ============================================

router.get("/api/v1/product-categories", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return productCategoryService.getCategories(pagination, filters);
  });
});

router.get("/api/v1/product-categories/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return productCategoryService.getCategoryById(params.id);
  });
});

router.post("/api/v1/product-categories", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateProductCategoryRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return productCategoryService.createCategory(body);
    },
    201
  );
});

router.put("/api/v1/product-categories/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateProductCategoryRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return productCategoryService.updateCategory(params.id, body);
  });
});

router.patch("/api/v1/product-categories/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateProductCategoryRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return productCategoryService.updateCategory(params.id, body);
  });
});

router.delete("/api/v1/product-categories/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return productCategoryService.deleteCategory(params.id);
  });
});

// ============================================
// PRODUCTS
// ============================================

router.get("/api/v1/products", async (request, url) => {
  return withAuth(request, async () => {
    const pagination = parsePagination(url);
    const filters = parseFilters(url);
    return productsService.getProducts(pagination, filters);
  });
});

router.get("/api/v1/products/low-stock", async (request) => {
  return withAuth(request, async () => {
    return productsService.getLowStockProducts();
  });
});

// Get popular products for autocomplete suggestions
router.get("/api/v1/products/popular", async (request, url) => {
  return withAuth(request, async () => {
    const limit = url.searchParams.get("limit");
    const currency = url.searchParams.get("currency");
    return productsService.getPopularProducts(
      limit ? parseInt(limit, 10) : 20,
      currency || undefined
    );
  });
});

// Increment product usage count (called when product is selected)
router.post("/api/v1/products/:id/increment-usage", async (request, _url, params) => {
  return withAuth(request, async () => {
    return productsService.incrementUsage(params.id);
  });
});

// Save line item as product (smart learning from invoices)
router.post("/api/v1/products/save-line-item", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<{
        name: string;
        price?: number | null;
        currency?: string | null;
        unit?: string | null;
        productId?: string;
      }>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return productsService.saveLineItemAsProduct(body);
    },
    201
  );
});

router.get("/api/v1/products/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return productsService.getProductById(params.id);
  });
});

router.get("/api/v1/products/sku/:sku", async (request, _url, params) => {
  return withAuth(request, async () => {
    return productsService.getProductBySku(params.sku);
  });
});

router.post("/api/v1/products", async (request) => {
  return withAuth(
    request,
    async () => {
      const body = await parseBody<CreateProductRequest>(request);
      if (!body) {
        return errorResponse("VALIDATION_ERROR", "Invalid request body");
      }
      return productsService.createProduct(body);
    },
    201
  );
});

router.put("/api/v1/products/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateProductRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return productsService.updateProduct(params.id, body);
  });
});

router.patch("/api/v1/products/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<UpdateProductRequest>(request);
    if (!body) {
      return errorResponse("VALIDATION_ERROR", "Invalid request body");
    }
    return productsService.updateProduct(params.id, body);
  });
});

router.delete("/api/v1/products/:id", async (request, _url, params) => {
  return withAuth(request, async () => {
    return productsService.deleteProduct(params.id);
  });
});

router.patch("/api/v1/products/:id/stock", async (request, _url, params) => {
  return withAuth(request, async () => {
    const body = await parseBody<{ quantity: number }>(request);
    if (!body || typeof body.quantity !== "number") {
      return errorResponse("VALIDATION_ERROR", "Quantity is required");
    }
    return productsService.updateStock(params.id, body.quantity);
  });
});

export const productRoutes = router.getRoutes();
