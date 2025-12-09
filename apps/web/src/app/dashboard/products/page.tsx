import type { ProductWithCategory } from "@crm/types";
import { PlusIcon } from "@radix-ui/react-icons";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ProductSheet } from "@/components/products/product-sheet";
import { ProductsDataTable } from "@/components/products/products-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { generateMeta } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: "Products",
    description: "Manage your products and inventory",
    canonical: "/dashboard/products",
  });
}

async function getProducts(): Promise<{
  products: ProductWithCategory[];
  stats: {
    total: number;
    totalStock: number;
    lowStock: number;
    outOfStock: number;
  };
}> {
  const API_URL = process.env.API_URL || "http://localhost:3001";

  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await fetch(`${API_URL}/api/v1/products?pageSize=100`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      logger.error("Failed to fetch products:", response.status);
      return {
        products: [],
        stats: { total: 0, totalStock: 0, lowStock: 0, outOfStock: 0 },
      };
    }

    const data = await response.json();
    const products: ProductWithCategory[] = data.data || [];

    // Calculate stats
    const stats = {
      total: products.length,
      totalStock: products.reduce((sum, p) => sum + (Number(p.stockQuantity) || 0), 0),
      lowStock: products.filter(
        (p) =>
          p.stockQuantity !== undefined &&
          p.minStockLevel !== undefined &&
          Number(p.stockQuantity) > 0 &&
          Number(p.stockQuantity) <= Number(p.minStockLevel)
      ).length,
      outOfStock: products.filter(
        (p) => p.stockQuantity !== undefined && Number(p.stockQuantity) === 0
      ).length,
    };

    return { products, stats };
  } catch (error) {
    logger.error("Error fetching products:", error);
    return {
      products: [],
      stats: { total: 0, totalStock: 0, lowStock: 0, outOfStock: 0 },
    };
  }
}

export default async function ProductsPage() {
  const { products, stats } = await getProducts();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <Button asChild>
          <Link href="/dashboard/products?type=create">
            <PlusIcon className="mr-2 h-4 w-4" /> Add Product
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Products</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">{stats.total}</CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-green-600">Active</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Stock</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {stats.totalStock.toLocaleString()}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-muted-foreground">units</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Low Stock</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">{stats.lowStock}</CardTitle>
            <CardAction>
              {stats.lowStock > 0 ? (
                <Badge variant="outline">
                  <span className="text-yellow-600">Warning</span>
                </Badge>
              ) : (
                <Badge variant="outline">
                  <span className="text-green-600">OK</span>
                </Badge>
              )}
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Out of Stock</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">{stats.outOfStock}</CardTitle>
            <CardAction>
              {stats.outOfStock > 0 ? (
                <Badge variant="outline">
                  <span className="text-red-600">Alert</span>
                </Badge>
              ) : (
                <Badge variant="outline">
                  <span className="text-green-600">OK</span>
                </Badge>
              )}
            </CardAction>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <CardDescription>Manage your products inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductsDataTable data={products} />
        </CardContent>
      </Card>

      <ProductSheet />
    </div>
  );
}
