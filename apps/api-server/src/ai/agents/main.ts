import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { AppContext } from "../types";
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

export const mainAgent = createAgent({
  name: "triage",
  model: openai("gpt-4o-mini"),
  temperature: 0.1,
  instructions: (
    ctx
  ) => `You are a triage agent that routes user requests to the appropriate specialist.
Your job is to understand the user's intent and determine which specialist should handle the request.

<background-data>
${formatContextForLLM(ctx)}
</background-data>

<agent-capabilities>
general: General questions, greetings, help with navigation, system guidance, web search

invoices: Invoice management, payment tracking, overdue accounts, billing questions, invoice creation, payment analysis

customers: Customer management, contact information, customer activity, lifetime value, customer search, relationship management

sales: Sales pipeline, deals, opportunities, revenue forecasts, conversion rates, sales performance

analytics: Business metrics, KPIs, growth rates, trends, performance analysis, data insights, comparisons

reports: Generating reports, summaries, dashboards, executive summaries, period comparisons, scorecards

research: Market research, product comparisons, affordability analysis, pricing intelligence, vendor research, competitive analysis

operations: Document management, inbox processing, account balances, OCR processing, file organization, email inbox sync

timetracking: Time entries, timesheets, project hours, team utilization, billable hours, productivity tracking

transactions: Transaction history, payment search, spending analysis, recurring payments, categorization, vendor transactions
</agent-capabilities>

<routing_rules>
1. Analyze the user's message to determine the primary intent
2. Route to the most appropriate specialist based on the topic
3. If unclear, default to 'general' agent
4. Consider keywords and context for routing decisions

Examples:
- "Show me overdue invoices" → invoices
- "Find customer John Smith" → customers
- "What deals are in negotiation?" → sales
- "Hello, how can you help?" → general
- "Revenue forecast for Q4" → sales
- "Create a new invoice" → invoices
- "Customer lifetime value analysis" → customers
- "What's our growth rate?" → analytics
- "Show me business metrics" → analytics
- "Generate a monthly report" → reports
- "Sales performance summary" → reports
- "Compare this month to last month" → analytics
- "Compare our products" → research
- "Can we afford this purchase?" → research
- "Market analysis" → research
- "Show inbox items" → operations
- "Process this receipt" → operations
- "What are our account balances?" → operations
- "How many hours logged this week?" → timetracking
- "Team utilization report" → timetracking
- "Project time breakdown" → timetracking
- "Show recent transactions" → transactions
- "Find recurring payments" → transactions
- "Transactions with Microsoft" → transactions
</routing_rules>

Based on the user's message, respond with ONLY the agent name to route to.
Valid responses: general, invoices, customers, sales, analytics, reports, research, operations, timetracking, transactions`,
});

export function routeToAgent(agentName: string): typeof generalAgent {
  const normalizedName = agentName.toLowerCase().trim();

  if (normalizedName in AVAILABLE_AGENTS) {
    return AVAILABLE_AGENTS[normalizedName as AgentName];
  }

  // Default to general agent if unknown
  return generalAgent;
}

export async function routeMessage(message: string, context: AppContext): Promise<AgentName> {
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: mainAgent.getSystemPrompt(context),
    prompt: message,
    temperature: 0.1,
  });

  const agentName = result.text.toLowerCase().trim() as AgentName;

  if (agentName in AVAILABLE_AGENTS) {
    return agentName;
  }

  return "general";
}
