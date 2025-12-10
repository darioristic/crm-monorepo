// Artifact/Canvas configuration for AI chat visualizations

export type ArtifactType =
  | "sales-funnel"
  | "customer-metrics"
  | "invoice-aging"
  | "revenue-breakdown"
  | "pipeline-overview";

export type ArtifactStage = "loading" | "chart_ready" | "metrics_ready" | "analysis_ready";

export interface ArtifactConfig {
  type: ArtifactType;
  title: string;
  description: string;
  icon: string;
}

export const ARTIFACT_CONFIGS: Record<ArtifactType, ArtifactConfig> = {
  "sales-funnel": {
    type: "sales-funnel",
    title: "Sales Funnel",
    description: "Visualize deal progression through pipeline stages",
    icon: "funnel",
  },
  "customer-metrics": {
    type: "customer-metrics",
    title: "Customer Metrics",
    description: "Customer distribution and growth trends",
    icon: "users",
  },
  "invoice-aging": {
    type: "invoice-aging",
    title: "Invoice Aging",
    description: "Accounts receivable aging analysis",
    icon: "clock",
  },
  "revenue-breakdown": {
    type: "revenue-breakdown",
    title: "Revenue Breakdown",
    description: "Revenue by source, product, or period",
    icon: "pie-chart",
  },
  "pipeline-overview": {
    type: "pipeline-overview",
    title: "Pipeline Overview",
    description: "Current sales pipeline health",
    icon: "bar-chart",
  },
};

export const STAGE_MESSAGES: Record<ArtifactStage, string> = {
  loading: "Preparing visualization...",
  chart_ready: "Chart data ready, calculating metrics...",
  metrics_ready: "Metrics calculated, generating insights...",
  analysis_ready: "Analysis complete",
};

export function getArtifactConfig(type: ArtifactType): ArtifactConfig {
  return ARTIFACT_CONFIGS[type];
}

export function getStageMessage(stage: ArtifactStage): string {
  return STAGE_MESSAGES[stage];
}
