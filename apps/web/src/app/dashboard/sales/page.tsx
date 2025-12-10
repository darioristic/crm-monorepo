import { EuroIcon, FileTextIcon, ReceiptIcon, TrendingUpIcon, TruckIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateMeta } from "@/lib/utils";

export async function generateMetadata() {
  return generateMeta({
    title: "Sales",
    description: "Sales overview - quotes, invoices, and delivery notes",
    canonical: "/dashboard/sales",
  });
}

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Overview</h1>
          <p className="text-muted-foreground">Manage quotes, invoices, and deliveries</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/sales/quotes">
              <FileTextIcon className="mr-2 h-4 w-4" />
              View Quotes
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/sales/invoices">
              <ReceiptIcon className="mr-2 h-4 w-4" />
              View Invoices
            </Link>
          </Button>
        </div>
      </div>

      {/* Sales KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <EuroIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€125,430</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+15%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Quotes</CardTitle>
            <FileTextIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">€34,500 potential value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
            <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€45,231</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-yellow-600">8 invoices</span> pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
            <TruckIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">2 scheduled for today</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <Link href="/dashboard/sales/quotes">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <FileTextIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Quotes</CardTitle>
                  <CardDescription>Create and manage quotes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active quotes</span>
                <span className="font-medium">24</span>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/dashboard/sales/invoices">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <ReceiptIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <CardTitle>Invoices</CardTitle>
                  <CardDescription>Manage your invoices</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total invoices</span>
                <span className="font-medium">156</span>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/dashboard/sales/delivery-notes">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                  <TruckIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Delivery Notes</CardTitle>
                  <CardDescription>Track deliveries</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pending deliveries</span>
                <span className="font-medium">5</span>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Recent Sales Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sales Activity</CardTitle>
          <CardDescription>Latest quotes, invoices, and deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <TrendingUpIcon className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Invoice INV-2024-042 paid</p>
                <p className="text-xs text-muted-foreground">TechCorp - €5,000</p>
              </div>
              <span className="text-xs text-muted-foreground">1h ago</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <FileTextIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">New quote QUO-2024-089 created</p>
                <p className="text-xs text-muted-foreground">Global Finance - €12,500</p>
              </div>
              <span className="text-xs text-muted-foreground">3h ago</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                <TruckIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Delivery DN-2024-015 completed</p>
                <p className="text-xs text-muted-foreground">HealthFirst Inc.</p>
              </div>
              <span className="text-xs text-muted-foreground">Yesterday</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
