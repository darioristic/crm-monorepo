import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { generateMeta } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: "New Product",
    description: "Create a new product",
    canonical: "/dashboard/products/new",
  });
}
export default function NewProductPage() {
  redirect("/dashboard/products?type=create");
}
