"use client";

import type { ProjectSummary, SalesSummary } from "@crm/types";
import {
  ArrowRightIcon,
  BarChart3Icon,
  FileTextIcon,
  FolderDotIcon,
  RefreshCwIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { reportsApi } from "@/lib/api";
import { logger } from "@/lib/logger";

export function ReportsOverview() {
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [salesRes, projectRes] = await Promise.all([
        reportsApi.getSalesSummary(),
        reportsApi.getProjectSummary(),
      ]);

      if (salesRes.success && salesRes.data) {
        setSalesSummary(salesRes.data);
      }
      if (projectRes.success && projectRes.data) {
        setProjectSummary(projectRes.data);
      }
    } catch (err) {
      setError("Failed to load report data");
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalRevenue = salesSummary
    ? salesSummary.totalInvoiceValue - salesSummary.unpaidAmount
    : 0;

  const conversionRate =
    salesSummary && salesSummary.totalQuotes > 0
      ? Math.round((salesSummary.acceptedQuotes / salesSummary.totalQuotes) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">View insights and analytics across your CRM</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCwIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">€{totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {salesSummary?.paidInvoices || 0} paid invoices
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <FolderDotIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{projectSummary?.activeProjects || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {projectSummary?.totalProjects || 0} total projects
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{conversionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {salesSummary?.acceptedQuotes || 0} of {salesSummary?.totalQuotes || 0} quotes
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{projectSummary?.completedTasks || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {projectSummary?.overdueTasks || 0} overdue
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report Categories */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <Link href="/dashboard/reports/sales">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
                  <FileTextIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <CardTitle>Sales Reports</CardTitle>
                  <CardDescription>View quotes, invoices, and revenue analytics</CardDescription>
                </div>
                <ArrowRightIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="text-center">
                      <Skeleton className="h-8 w-16 mx-auto mb-1" />
                      <Skeleton className="h-4 w-12 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">
                      €{((salesSummary?.totalInvoiceValue || 0) / 1000).toFixed(0)}k
                    </p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{salesSummary?.totalInvoices || 0}</p>
                    <p className="text-xs text-muted-foreground">Invoices</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{salesSummary?.totalQuotes || 0}</p>
                    <p className="text-xs text-muted-foreground">Quotes</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/dashboard/reports/projects">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950">
                  <FolderDotIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <CardTitle>Project Reports</CardTitle>
                  <CardDescription>Track project progress, tasks, and milestones</CardDescription>
                </div>
                <ArrowRightIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="text-center">
                      <Skeleton className="h-8 w-16 mx-auto mb-1" />
                      <Skeleton className="h-4 w-12 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{projectSummary?.totalProjects || 0}</p>
                    <p className="text-xs text-muted-foreground">Projects</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{projectSummary?.totalTasks || 0}</p>
                    <p className="text-xs text-muted-foreground">Tasks</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{projectSummary?.totalMilestones || 0}</p>
                    <p className="text-xs text-muted-foreground">Milestones</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
          <CardDescription>Key metrics at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <Skeleton className="h-10 w-48" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-medium">Outstanding Invoices</p>
                  <p className="text-sm text-muted-foreground">
                    {salesSummary?.overdueInvoices || 0} overdue
                  </p>
                </div>
                <p className="text-lg font-bold text-amber-600">
                  €{(salesSummary?.unpaidAmount || 0).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-medium">Task Completion Rate</p>
                  <p className="text-sm text-muted-foreground">
                    {projectSummary?.completedTasks || 0} completed
                  </p>
                </div>
                <p className="text-lg font-bold text-green-600">
                  {projectSummary && projectSummary.totalTasks > 0
                    ? Math.round((projectSummary.completedTasks / projectSummary.totalTasks) * 100)
                    : 0}
                  %
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Milestone Progress</p>
                  <p className="text-sm text-muted-foreground">
                    {projectSummary?.completedMilestones || 0} of{" "}
                    {projectSummary?.totalMilestones || 0} completed
                  </p>
                </div>
                <p className="text-lg font-bold">
                  {projectSummary && projectSummary.totalMilestones > 0
                    ? Math.round(
                        (projectSummary.completedMilestones / projectSummary.totalMilestones) * 100
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
