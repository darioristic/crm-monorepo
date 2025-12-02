import { openai } from "@ai-sdk/openai";
import { createAgent, formatContextForLLM } from "./config/shared";
import { customersAgent } from "./customers";
import { generalAgent } from "./general";
import { invoicesAgent } from "./invoices";
import { salesAgent } from "./sales";

export const AVAILABLE_AGENTS = {
  general: generalAgent,
  invoices: invoicesAgent,
  customers: customersAgent,
  sales: salesAgent,
} as const;

export type AgentName = keyof typeof AVAILABLE_AGENTS;

export const mainAgent = createAgent({
  name: "triage",
  model: openai("gpt-4o-mini"),
  temperature: 0.1,
  instructions: (ctx) => `You are a triage agent that routes user requests to the appropriate specialist.
Your job is to understand the user's intent and determine which specialist should handle the request.

<background-data>
${formatContextForLLM(ctx)}
</background-data>

<agent-capabilities>
general: General questions, greetings, help with navigation, system guidance, web search

invoices: Invoice management, payment tracking, overdue accounts, billing questions, invoice creation, payment analysis

customers: Customer management, contact information, customer activity, lifetime value, customer search, relationship management

sales: Sales pipeline, deals, opportunities, revenue forecasts, conversion rates, sales performance
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
</routing_rules>

Based on the user's message, respond with ONLY the agent name to route to.
Valid responses: general, invoices, customers, sales`,
});

export function routeToAgent(agentName: string): typeof generalAgent {
  const normalizedName = agentName.toLowerCase().trim();
  
  if (normalizedName in AVAILABLE_AGENTS) {
    return AVAILABLE_AGENTS[normalizedName as AgentName];
  }
  
  // Default to general agent if unknown
  return generalAgent;
}

