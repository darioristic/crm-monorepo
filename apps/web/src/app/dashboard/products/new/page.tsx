import { generateMeta } from "@/lib/utils";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { ProductForm } from "@/components/products/product-form";
import type { ProductCategory } from "@crm/types";

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: "New Product",
    description: "Create a new product",
    canonical: "/dashboard/products/new",
  });
}

async function getCategories(): Promise<ProductCategory[]> {
  const API_URL = process.env.API_URL || "http://localhost:3001";

  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const response = await fetch(`${API_URL}/api/v1/product-categories`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Product</h1>
        <p className="text-muted-foreground">
          Add a new product or service to your catalog
        </p>
      </div>
      <ProductForm mode="create" categories={categories} />
    </div>
  );
}

