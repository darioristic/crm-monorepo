/**
 * Product Routes - Products, Categories
 */

import { errorResponse } from "@crm/utils";
import { productsService, productCategoryService } from "../services/products.service";
import { RouteBuilder, withAuth, parseBody, parsePagination, parseFilters } from "./helpers";
import type { CreateProductRequest, UpdateProductRequest, CreateProductCategoryRequest, UpdateProductCategoryRequest } from "@crm/types";

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
