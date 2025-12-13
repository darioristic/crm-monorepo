"use client";

import {
  ArrowRightLeft,
  DollarSign,
  FileText,
  HeartPulse,
  History,
  LineChart,
  PieChart,
  Plane,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ARTIFACT_CONFIG, type ArtifactType } from "./artifact-types";

// Icon mapping
const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingDown,
  Plane,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  LineChart,
  HeartPulse,
  PieChart,
  History,
  FileText,
  Users,
};

interface ArtifactData {
  type: ArtifactType;
  data?: Record<string, unknown>;
  stage?: "loading" | "chart_ready" | "metrics_ready" | "analysis_ready";
}

interface CanvasProps {
  artifact: ArtifactData | null;
  onClose: () => void;
  className?: string;
}

export function Canvas({ artifact, onClose, className }: CanvasProps) {
  if (!artifact) return null;

  const config = ARTIFACT_CONFIG[artifact.type];
  const Icon = icons[config.icon] || LineChart;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 bottom-0 w-[600px] bg-background border-l shadow-xl z-50",
        "transform transition-transform duration-300 ease-in-out",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", `bg-${config.color}-500/10`)}>
            <Icon className={cn("h-5 w-5", `text-${config.color}-500`)} />
          </div>
          <div>
            <h2 className="font-semibold">{config.title}</h2>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto h-[calc(100%-73px)]">
        {artifact.stage === "loading" ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">
                Loading {config.title.toLowerCase()}...
              </p>
            </div>
          </div>
        ) : (
          <ArtifactContent artifact={artifact} />
        )}
      </div>
    </div>
  );
}

// Render artifact content based on type
function ArtifactContent({ artifact }: { artifact: ArtifactData }) {
  const data = artifact.data || {};

  switch (artifact.type) {
    case "burn-rate":
      return <BurnRateArtifact data={data} />;
    case "runway":
      return <RunwayArtifact data={data} />;
    case "cash-flow":
      return <CashFlowArtifact data={data} />;
    case "revenue":
      return <RevenueArtifact data={data} />;
    case "profit-loss":
      return <ProfitLossArtifact data={data} />;
    case "financial-health":
      return <HealthScoreArtifact data={data} />;
    default:
      return <GenericArtifact data={data} />;
  }
}

// Burn Rate Artifact
function BurnRateArtifact({ data }: { data: Record<string, unknown> }) {
  const burnRate = (data.monthlyBurnRate as number) || 0;
  const trend = (data.trend as number) || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Burn Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {new Intl.NumberFormat("sr-RS", { style: "currency", currency: "EUR" }).format(
              burnRate
            )}
          </div>
          <div className={cn("text-sm mt-1", trend > 0 ? "text-red-500" : "text-green-500")}>
            {trend > 0 ? "+" : ""}
            {trend.toFixed(1)}% vs last month
          </div>
        </CardContent>
      </Card>
      <MetricPlaceholder title="Burn Rate Trend (6 months)" />
    </div>
  );
}

// Runway Artifact
function RunwayArtifact({ data }: { data: Record<string, unknown> }) {
  const months = (data.runwayMonths as number) || 0;
  const cashBalance = (data.cashBalance as number) || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Financial Runway</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{months.toFixed(1)} months</div>
          <div className="text-sm text-muted-foreground mt-1">
            Based on{" "}
            {new Intl.NumberFormat("sr-RS", { style: "currency", currency: "EUR" }).format(
              cashBalance
            )}{" "}
            cash balance
          </div>
        </CardContent>
      </Card>
      <MetricPlaceholder title="Runway Projection" />
    </div>
  );
}

// Cash Flow Artifact
function CashFlowArtifact({ data }: { data: Record<string, unknown> }) {
  const inflow = (data.totalInflow as number) || 0;
  const outflow = (data.totalOutflow as number) || 0;
  const net = inflow - outflow;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inflow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {new Intl.NumberFormat("sr-RS", { style: "currency", currency: "EUR" }).format(
                inflow
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outflow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {new Intl.NumberFormat("sr-RS", { style: "currency", currency: "EUR" }).format(
                outflow
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Net Cash Flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn("text-2xl font-bold", net >= 0 ? "text-green-500" : "text-red-500")}>
            {new Intl.NumberFormat("sr-RS", { style: "currency", currency: "EUR" }).format(net)}
          </div>
        </CardContent>
      </Card>
      <MetricPlaceholder title="Cash Flow Over Time" />
    </div>
  );
}

// Revenue Artifact
function RevenueArtifact({ data }: { data: Record<string, unknown> }) {
  const total = (data.totalRevenue as number) || 0;
  const growth = (data.growth as number) || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Total Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {new Intl.NumberFormat("sr-RS", { style: "currency", currency: "EUR" }).format(total)}
          </div>
          <div className={cn("text-sm mt-1", growth >= 0 ? "text-green-500" : "text-red-500")}>
            {growth >= 0 ? "+" : ""}
            {growth.toFixed(1)}% growth
          </div>
        </CardContent>
      </Card>
      <MetricPlaceholder title="Revenue Trend" />
    </div>
  );
}

// Profit & Loss Artifact
function ProfitLossArtifact({ data }: { data: Record<string, unknown> }) {
  const revenue = (data.revenue as number) || 0;
  const expenses = (data.expenses as number) || 0;
  const profit = revenue - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {new Intl.NumberFormat("sr-RS", {
                style: "currency",
                currency: "EUR",
                notation: "compact",
              }).format(revenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {new Intl.NumberFormat("sr-RS", {
                style: "currency",
                currency: "EUR",
                notation: "compact",
              }).format(expenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Profit</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn("text-xl font-bold", profit >= 0 ? "text-green-500" : "text-red-500")}
            >
              {new Intl.NumberFormat("sr-RS", {
                style: "currency",
                currency: "EUR",
                notation: "compact",
              }).format(profit)}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Profit Margin</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn("text-2xl font-bold", margin >= 0 ? "text-green-500" : "text-red-500")}
          >
            {margin.toFixed(1)}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Health Score Artifact
function HealthScoreArtifact({ data }: { data: Record<string, unknown> }) {
  const score = (data.score as number) || 0;
  const status = (data.status as string) || "Unknown";

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-yellow-500";
    if (s >= 40) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Business Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("text-5xl font-bold", getScoreColor(score))}>{score}</div>
          <div className="text-sm text-muted-foreground mt-2">Status: {status}</div>
        </CardContent>
      </Card>
      <MetricPlaceholder title="Health Score Breakdown" />
    </div>
  );
}

// Generic Artifact
function GenericArtifact({ data }: { data: Record<string, unknown> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Data</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-xs overflow-auto bg-muted p-3 rounded-md">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

// Placeholder for charts (would use recharts or similar in production)
function MetricPlaceholder({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 bg-muted/50 rounded-lg flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Chart visualization</div>
        </div>
      </CardContent>
    </Card>
  );
}
