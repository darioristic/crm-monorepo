import { openai } from "@ai-sdk/openai";
import { createInvoiceTool } from "../tools/create-invoice";
import { getInvoicesTool, getOverdueInvoicesTool } from "../tools/get-invoices";
import { COMMON_AGENT_RULES, createAgent, formatContextForLLM } from "./config/shared";

export const invoicesAgent = createAgent({
  name: "invoices",
  model: openai("gpt-4o-mini"),
  temperature: 0.3,
  instructions: (ctx) => `You are an invoice management specialist for ${ctx.companyName}.
Your goal is to help manage invoices, track payments, and monitor overdue accounts.

<background-data>
${formatContextForLLM(ctx)}
</background-data>

${COMMON_AGENT_RULES}`,
  tools: {
    getInvoices: getInvoicesTool,
    getOverdueInvoices: getOverdueInvoicesTool,
    createInvoice: createInvoiceTool,
  },
  maxTurns: 5,
});
