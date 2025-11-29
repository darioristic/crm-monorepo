import { generateMeta } from "@/lib/utils";
import Link from "next/link";
import { PlusIcon } from "@radix-ui/react-icons";
import { Metadata } from "next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: "Product List",
    description: "Product list page for CRM Dashboard.",
    canonical: "/dashboard/products",
  });
}

// Sample products data
const products = [
  {
    id: 1,
    name: "Sports Shoes",
    sku: "PRD-001",
    price: 89.99,
    stock: 156,
    category: "Footwear",
    status: "active",
  },
  {
    id: 2,
    name: "Black T-Shirt",
    sku: "PRD-002",
    price: 29.99,
    stock: 342,
    category: "Clothing",
    status: "active",
  },
  {
    id: 3,
    name: "Jeans",
    sku: "PRD-003",
    price: 59.99,
    stock: 89,
    category: "Clothing",
    status: "active",
  },
  {
    id: 4,
    name: "Red Sneakers",
    sku: "PRD-004",
    price: 119.99,
    stock: 45,
    category: "Footwear",
    status: "low-stock",
  },
  {
    id: 5,
    name: "Red Scarf",
    sku: "PRD-005",
    price: 24.99,
    stock: 0,
    category: "Accessories",
    status: "out-of-stock",
  },
  {
    id: 6,
    name: "Kitchen Accessory",
    sku: "PRD-006",
    price: 34.99,
    stock: 78,
    category: "Home",
    status: "active",
  },
];

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <Button asChild>
          <Link href="/dashboard/products">
            <PlusIcon className="mr-2 h-4 w-4" /> Add Product
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Products</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {products.length}
            </CardTitle>
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
              {products.reduce((acc, p) => acc + p.stock, 0)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-green-600">+5.02%</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Low Stock</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {products.filter((p) => p.status === "low-stock").length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-yellow-600">Warning</span>
              </Badge>
            </CardAction>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Out of Stock</CardDescription>
            <CardTitle className="font-display text-2xl lg:text-3xl">
              {products.filter((p) => p.status === "out-of-stock").length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <span className="text-red-600">Alert</span>
              </Badge>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell className="text-right">
                    ${product.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">{product.stock}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        product.status === "active"
                          ? "success"
                          : product.status === "low-stock"
                          ? "warning"
                          : "destructive"
                      }
                    >
                      {product.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
