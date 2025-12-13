import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { analyticsAgent } from "./analytics";
import { createAgent, formatContextForLLM } from "./config/shared";
import { customersAgent } from "./customers";
import { generalAgent } from "./general";
import { invoicesAgent } from "./invoices";
import { operationsAgent } from "./operations";
import { reportsAgent } from "./reports";
import { researchAgent } from "./research";
import { salesAgent } from "./sales";
import { timeTrackingAgent } from "./timetracking";
import { transactionsAgent } from "./transactions";

// Main triage agent - identical pattern to Midday
export const mainAgent = createAgent({
  name: "triage",
  model: openai("gpt-4o-mini"),
  temperature: 0.1,
  modelSettings: {
    toolChoice: {
      type: "tool",
      toolName: "handoff_to_agent",
    },
  },
  instructions: (ctx) => `Route user requests to the appropriate specialist.

<background-data>
${formatContextForLLM(ctx)}

<agent-capabilities>
general: General questions, greetings, web search

research: AFFORDABILITY ANALYSIS ("can I afford X?", "should I buy X?"), purchase decisions, market comparisons
operations: Account balances, documents, inbox
reports: Financial reports (revenue, expenses, spending, burn rate, runway, P&L, cash flow, financial health)
analytics: Predictions, advanced analytics, business metrics, KPIs, growth rates
transactions: Transaction history, payment search, recurring payments
invoices: Invoice management, payment tracking, overdue accounts
customers: Customer management, contact information, lifetime value
sales: Sales pipeline, deals, opportunities, revenue forecasts
timetracking: Time tracking, timesheets, project hours, team utilization
</agent-capabilities>
</background-data>`,
  handoffs: [
    generalAgent,
    researchAgent,
    operationsAgent,
    reportsAgent,
    analyticsAgent,
    transactionsAgent,
    invoicesAgent,
    customersAgent,
    salesAgent,
    timeTrackingAgent,
  ],
  maxTurns: 1,
});

// Export available agents for reference
export const AVAILABLE_AGENTS = {
  general: generalAgent,
  invoices: invoicesAgent,
  customers: customersAgent,
  sales: salesAgent,
  analytics: analyticsAgent,
  reports: reportsAgent,
  research: researchAgent,
  operations: operationsAgent,
  timetracking: timeTrackingAgent,
  transactions: transactionsAgent,
} as const;

export type AgentName = keyof typeof AVAILABLE_AGENTS;

export function routeToAgent(name: string) {
  const key = (name || "").toLowerCase() as AgentName;
  return AVAILABLE_AGENTS[key] || AVAILABLE_AGENTS.general;
}

export async function routeMessage(message: string, appContext: unknown): Promise<AgentName> {
  try {
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: `Route user requests to the appropriate specialist.

<background-data>
${formatContextForLLM(appContext as import("../types").AppContext)}
</background-data>`,
      messages: [{ role: "user", content: message }],
    });
    let name = "general" as AgentName;
    try {
      const obj = JSON.parse(result.text || "{}");
      const candidate = String(obj.agent || "").toLowerCase();
      if ((Object.keys(AVAILABLE_AGENTS) as Array<AgentName>).includes(candidate as AgentName)) {
        name = candidate as AgentName;
      }
    } catch {}
    return name;
  } catch {
    return "general";
  }
}
