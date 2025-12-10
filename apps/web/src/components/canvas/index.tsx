"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ArtifactType } from "@/lib/artifact-config";
import { CustomerMetricsCanvas } from "./customer-metrics-canvas";
import { SalesFunnelCanvas } from "./sales-funnel-canvas";

interface CanvasRouterProps {
  data?: any;
}

export function CanvasRouter({ data }: CanvasRouterProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const artifactType = searchParams.get("artifact-type") as ArtifactType | null;

  if (!artifactType) return null;

  const handleClose = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("artifact-type");
    router.push(`?${params.toString()}`);
  };

  switch (artifactType) {
    case "sales-funnel":
      return <SalesFunnelCanvas data={data?.funnelData} onClose={handleClose} />;
    case "customer-metrics":
      return (
        <CustomerMetricsCanvas
          typeData={data?.typeData}
          growthData={data?.growthData}
          metrics={data?.metrics}
          onClose={handleClose}
        />
      );
    case "invoice-aging":
      // TODO: Implement InvoiceAgingCanvas
      return null;
    case "revenue-breakdown":
      // TODO: Implement RevenueBreakdownCanvas
      return null;
    case "pipeline-overview":
      // TODO: Implement PipelineOverviewCanvas
      return null;
    default:
      return null;
  }
}

export { BaseCanvas } from "./base-canvas";
export { CustomerMetricsCanvas } from "./customer-metrics-canvas";
export { SalesFunnelCanvas } from "./sales-funnel-canvas";
