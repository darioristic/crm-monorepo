/**
 * AI Chat Routes - Streaming chat endpoint
 */

import { openai } from "@ai-sdk/openai";
import { errorResponse } from "@crm/utils";
import { type CoreMessage, generateText, streamText } from "ai";
import { z } from "zod";
// Import AI components
import { AVAILABLE_AGENTS, mainAgent, routeToAgent } from "../ai/agents";
import { buildAppContext, getChatHistory, saveChatMessage } from "../ai/agents/config/shared";
import {
  getCustomerByIdTool,
  getCustomersTool,
  getIndustriesSummaryTool,
} from "../ai/tools/get-customers";
// Import tools
import { getInvoicesTool, getOverdueInvoicesTool } from "../ai/tools/get-invoices";
import { createInvoiceTool } from "../ai/tools/create-invoice";
import { getProductCategoriesSummaryTool, getProductsTool } from "../ai/tools/get-products";
import { getQuoteConversionRateTool, getQuotesTool } from "../ai/tools/get-quotes";
// Financial Analysis Tools
import { getBurnRateTool } from "../ai/tools/get-burn-rate";
import { getRunwayTool } from "../ai/tools/get-runway";
import { getCashFlowTool } from "../ai/tools/get-cash-flow";
import { getRevenueTool } from "../ai/tools/get-revenue";
import { getExpensesTool } from "../ai/tools/get-expenses";
import { getForecastTool } from "../ai/tools/get-forecast";
import { getProfitLossTool } from "../ai/tools/get-profit-loss";
import { getFinancialHealthTool } from "../ai/tools/get-financial-health";
import { getSpendingInsightsTool } from "../ai/tools/get-spending-insights";
import type { ChatUserContext, ToolSet } from "../ai/types";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";

// Chat request schema
const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  chatId: z.string().optional(),
  timezone: z.string().optional(),
});

// All available tools
const tools = {
  // CRM Tools
  getInvoices: getInvoicesTool,
  getOverdueInvoices: getOverdueInvoicesTool,
  createInvoice: createInvoiceTool,
  getCustomers: getCustomersTool,
  getCustomerById: getCustomerByIdTool,
  getIndustriesSummary: getIndustriesSummaryTool,
  getProducts: getProductsTool,
  getProductCategories: getProductCategoriesSummaryTool,
  getQuotes: getQuotesTool,
  getQuoteConversion: getQuoteConversionRateTool,
  // Financial Analysis Tools
  getBurnRate: getBurnRateTool,
  getRunway: getRunwayTool,
  getCashFlow: getCashFlowTool,
  getRevenue: getRevenueTool,
  getExpenses: getExpensesTool,
  getForecast: getForecastTool,
  getProfitLoss: getProfitLossTool,
  getFinancialHealth: getFinancialHealthTool,
  getSpendingInsights: getSpendingInsightsTool,
};

// Get tools for specific agent
function getAgentTools(agentName: string) {
  switch (agentName) {
    case "invoices":
      return {
        getInvoices: tools.getInvoices,
        getOverdueInvoices: tools.getOverdueInvoices,
        createInvoice: tools.createInvoice,
      };
    case "customers":
      return {
        getCustomers: tools.getCustomers,
        getCustomerById: tools.getCustomerById,
        getIndustriesSummary: tools.getIndustriesSummary,
      };
    case "sales":
      return {
        getQuotes: tools.getQuotes,
        getQuoteConversion: tools.getQuoteConversion,
        getInvoices: tools.getInvoices,
        getCustomers: tools.getCustomers,
      };
    case "analytics":
    case "finance":
    case "financial":
      return {
        getBurnRate: tools.getBurnRate,
        getRunway: tools.getRunway,
        getCashFlow: tools.getCashFlow,
        getRevenue: tools.getRevenue,
        getExpenses: tools.getExpenses,
        getForecast: tools.getForecast,
        getProfitLoss: tools.getProfitLoss,
        getFinancialHealth: tools.getFinancialHealth,
        getSpendingInsights: tools.getSpendingInsights,
      };
    default:
      return tools; // General agent gets all tools
  }
}

// Chat routes
export const chatRoutes: Route[] = [
  // POST /api/v1/chat - Main chat endpoint with streaming
  {
    method: "POST",
    pattern: /^\/api\/v1\/chat$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = await request.json();
        logger.info({ body }, "[Chat] Received request");

        const validationResult = chatRequestSchema.safeParse(body);

        if (!validationResult.success) {
          logger.error({ error: validationResult.error }, "Chat validation failed");
          return json(errorResponse("VALIDATION_ERROR", validationResult.error.message), 400);
        }

        const { message, chatId = crypto.randomUUID(), timezone } = validationResult.data;
        logger.info({ message, chatId }, "[Chat] Parsed message");

        // Build user context - use activeTenantId for proper multi-tenant support
        const userContext: ChatUserContext = {
          userId: auth.userId,
          teamId: auth.activeTenantId || auth.companyId || auth.userId,
          teamName: null,
          fullName: null,
          baseCurrency: "EUR",
          locale: "sr-RS",
          timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        const appContext = buildAppContext(userContext, chatId);
        logger.info({
          teamId: userContext.teamId,
          activeTenantId: auth.activeTenantId,
          companyId: auth.companyId,
          userId: auth.userId
        }, "[Chat] User context built");

        // Get chat history
        const history = await getChatHistory(chatId, 10);
        logger.info({ historyLength: history.length }, "[Chat] Got history");

        // Route to appropriate agent using triage agent
        logger.info("[Chat] Routing to agent...");
        const routing = await generateText({
          model: openai("gpt-4o-mini"),
          system: mainAgent.getSystemPrompt(appContext),
          messages: [{ role: "user", content: message }],
        });
        const agentName = routing.text.trim();
        logger.info({ agentName }, "[Chat] Routed to agent");

        const selectedAgent = routeToAgent(agentName);
        const agentTools = getAgentTools(agentName);
        logger.info({ toolCount: Object.keys(agentTools).length }, "[Chat] Got agent tools");

        // Save user message to history
        await saveChatMessage(chatId, {
          role: "user",
          content: message,
        });

        // Build messages array
        const messages: CoreMessage[] = [...history, { role: "user", content: message }];

        // Generate response (non-streaming for Bun compatibility)
        logger.info("[Chat] Generating response...");

        const result = await generateText({
          model: openai("gpt-4o-mini"),
          system: selectedAgent.getSystemPrompt(appContext),
          messages,
          tools: agentTools as unknown as ToolSet,
          maxSteps: 5,
        });

        logger.info({
          textLength: result.text?.length,
          toolCalls: result.toolCalls?.length,
          toolResults: result.toolResults?.length,
        }, "[Chat] Generation complete");

        const responseText = result.text || "I couldn't generate a response. Please try again.";

        // Save assistant response to history
        await saveChatMessage(chatId, {
          role: "assistant",
          content: responseText,
        });

        // Return JSON response
        return json({
          success: true,
          data: {
            chatId,
            message: {
              id: crypto.randomUUID(),
              role: "assistant",
              content: responseText,
            },
          },
        });
      } catch (error) {
        logger.error({ error }, "Error in chat endpoint");
        return json(errorResponse("INTERNAL_ERROR", "Chat processing failed"), 500);
      }
    },
    params: [],
  },

  // GET /api/v1/chat/history/:chatId - Get chat history
  {
    method: "GET",
    pattern: /^\/api\/v1\/chat\/history\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const chatId = params.chatId;
        const history = await getChatHistory(chatId, 50);

        return json({
          success: true,
          data: {
            chatId,
            messages: history,
          },
        });
      } catch (error) {
        logger.error({ error }, "Error getting chat history");
        return json(errorResponse("INTERNAL_ERROR", "Failed to get chat history"), 500);
      }
    },
    params: ["chatId"],
  },

  // GET /api/v1/chat/agents - List available agents
  {
    method: "GET",
    pattern: /^\/api\/v1\/chat\/agents$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const agents = Object.keys(AVAILABLE_AGENTS).map((name) => ({
        name,
        description: getAgentDescription(name),
      }));

      return json({
        success: true,
        data: agents,
      });
    },
    params: [],
  },
];

function getAgentDescription(name: string): string {
  const descriptions: Record<string, string> = {
    general: "General questions, help, and navigation",
    invoices: "Invoice management, payments, and billing",
    customers: "Customer relationships and contact management",
    sales: "Sales pipeline, quotes, and revenue",
    analytics: "Financial analysis, burn rate, runway, cash flow, forecasting, and business metrics",
    reports: "Generating reports, summaries, and dashboards",
  };
  return descriptions[name] || "Specialized assistant";
}

export default chatRoutes;
