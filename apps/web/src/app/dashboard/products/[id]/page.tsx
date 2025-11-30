import { generateMeta } from "@/lib/utils";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Pencil, Package } from "lucide-react";
import type { ProductWithCategory } from "@crm/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProduct(id: string): Promise<ProductWithCategory | null> {
  const API_URL = process.env.API_URL || "http://localhost:3001";

  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await fetch(`${API_URL}/api/v1/products/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error("Error fetching product:", error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  return generateMeta({
    title: product?.name || "Product Details",
    description: product?.description || "View product details",
    canonical: `/dashboard/products/${id}`,
  });
}

function formatCurrency(value: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function getStockStatus(product: ProductWithCategory): {
  label: string;
  variant: "success" | "warning" | "destructive" | "outline";
} {
  const stock = Number(product.stockQuantity) || 0;
  const minStock = Number(product.minStockLevel) || 0;

  if (product.isService) {
    return { label: "Service", variant: "outline" };
  }
  if (stock === 0) {
    return { label: "Out of Stock", variant: "destructive" };
  }
  if (stock <= minStock) {
    return { label: "Low Stock", variant: "warning" };
  }
  return { label: "In Stock", variant: "success" };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const stockStatus = getStockStatus(product);
  const margin = product.costPrice
    ? ((Number(product.unitPrice) - Number(product.costPrice)) /
        Number(product.unitPrice)) *
      100
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">
              {product.sku ? `SKU: ${product.sku}` : "Product Details"}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/dashboard/products/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" /> Edit Product
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-lg">
                <Package className="text-muted-foreground h-6 w-6" />
              </div>
              <div>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>
                  {product.category?.name || "Uncategorized"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {product.description && (
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                  Description
                </h4>
                <p className="text-sm">{product.description}</p>
              </div>
            )}

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                  Unit Price
                </h4>
                <p className="text-2xl font-bold">
                  {formatCurrency(Number(product.unitPrice), product.currency)}
                </p>
              </div>
              {product.costPrice && (
                <div>
                  <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                    Cost Price
                  </h4>
                  <p className="text-2xl font-bold">
                    {formatCurrency(Number(product.costPrice), product.currency)}
                  </p>
                </div>
              )}
            </div>

            {margin !== null && (
              <div>
                <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                  Profit Margin
                </h4>
                <p className="text-lg font-semibold text-green-600">
                  {margin.toFixed(1)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Active</span>
                <Badge variant={product.isActive ? "success" : "secondary"}>
                  {product.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Type</span>
                <Badge variant="outline">
                  {product.isService ? "Service" : "Product"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Stock Status</span>
                <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
              </div>
            </CardContent>
          </Card>

          {!product.isService && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">In Stock</span>
                  <span className="font-medium">
                    {Number(product.stockQuantity) || 0} {product.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">
                    Min Level
                  </span>
                  <span className="font-medium">
                    {Number(product.minStockLevel) || 0} {product.unit}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Unit</span>
                <span className="font-medium capitalize">{product.unit}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Tax Rate</span>
                <span className="font-medium">
                  {Number(product.taxRate) || 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Currency</span>
                <span className="font-medium">{product.currency}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Created</span>
                <span className="font-medium">
                  {`${new Date(product.createdAt).getDate().toString().padStart(2, "0")}.${(new Date(product.createdAt).getMonth() + 1).toString().padStart(2, "0")}.${new Date(product.createdAt).getFullYear()}`}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

