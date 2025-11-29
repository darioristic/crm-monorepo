import { generateMeta } from "@/lib/utils";
import { ReportsOverview } from "./reports-overview";

export async function generateMetadata() {
  return generateMeta({
    title: "Reports",
    description: "Analytics and reporting dashboard",
    canonical: "/dashboard/reports"
  });
}

export default function ReportsPage() {
  return <ReportsOverview />;
}
