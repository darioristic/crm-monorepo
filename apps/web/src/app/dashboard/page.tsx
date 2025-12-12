"use client";

import { MetricsView } from "@/components/metrics/metrics-view";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { WidgetProvider, WidgetsGrid, WidgetsHeader } from "@/components/widgets";
import { ChatInputSimple } from "@/components/widgets/chat-input-simple";
import { useOverviewTab } from "@/hooks/use-overview-tab";

export default function DashboardPage() {
  const { tab, setTab } = useOverviewTab();

  return (
    <WidgetProvider>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col min-h-[calc(100vh-var(--header-height)-2rem)]">
          {/* Header with greeting and tabs */}
          <WidgetsHeader userName="Dario" />

          {/* Tab Content */}
          <div className="flex-1">
            <TabsContent value="overview" className="mt-0">
              <WidgetsGrid />
            </TabsContent>
            <TabsContent value="metrics" className="mt-0">
              <MetricsView />
            </TabsContent>
          </div>

          {/* Chat Input at bottom */}
          <div className="mt-8 pb-6">
            <ChatInputSimple />
          </div>
        </div>
      </Tabs>
    </WidgetProvider>
  );
}
