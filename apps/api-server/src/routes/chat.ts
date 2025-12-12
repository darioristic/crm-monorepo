/**
 * AI Chat Routes - Streaming chat endpoint
 */

import { openai } from "@ai-sdk/openai";
import { errorResponse } from "@crm/utils";
import { type CoreMessage, generateText } from "ai";
import { z } from "zod";
// Import AI components
import { AVAILABLE_AGENTS, mainAgent, routeToAgent } from "../ai/agents";
import { buildAppContext, getChatHistory, saveChatMessage } from "../ai/agents/config/shared";
import { createCustomerTool } from "../ai/tools/create-customer";
import { createInvoiceTool } from "../ai/tools/create-invoice";
// Financial Analysis Tools
import { getBurnRateTool } from "../ai/tools/get-burn-rate";
import { getCashFlowTool } from "../ai/tools/get-cash-flow";
import {
  getCustomerByIdTool,
  getCustomersTool,
  getIndustriesSummaryTool,
} from "../ai/tools/get-customers";
import { getExpensesTool } from "../ai/tools/get-expenses";
import { getFinancialHealthTool } from "../ai/tools/get-financial-health";
import { getForecastTool } from "../ai/tools/get-forecast";
// Import tools
import { getInvoicesTool, getOverdueInvoicesTool } from "../ai/tools/get-invoices";
import { getProductCategoriesSummaryTool, getProductsTool } from "../ai/tools/get-products";
import { getProfitLossTool } from "../ai/tools/get-profit-loss";
import { getQuoteConversionRateTool, getQuotesTool } from "../ai/tools/get-quotes";
import { getRevenueTool } from "../ai/tools/get-revenue";
import { getRunwayTool } from "../ai/tools/get-runway";
import { getSpendingInsightsTool } from "../ai/tools/get-spending-insights";
// Operations Tools
import {
  getAccountBalancesTool,
  getDocumentsTool,
  getInboxItemsTool,
  getInboxStatsTool,
  processInboxItemTool,
} from "../ai/tools/operations-tools";
// Research Tools
import {
  analyzeAffordabilityTool,
  compareProductsTool,
  marketResearchTool,
  priceComparisonTool,
} from "../ai/tools/research-tools";
// Time Tracking Tools
import {
  getProjectTimeTool,
  getTeamUtilizationTool,
  getTimeEntriesTool,
  getTimeStatsTool,
} from "../ai/tools/timetracking-tools";
// Transactions Tools
import {
  getRecurringTransactionsTool,
  getTransactionStatsTool,
  getTransactionsByVendorTool,
  getTransactionsTool,
  searchTransactionsTool,
} from "../ai/tools/transactions-tools";
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
  createCustomer: createCustomerTool,
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
  // Research Tools
  compareProducts: compareProductsTool,
  analyzeAffordability: analyzeAffordabilityTool,
  marketResearch: marketResearchTool,
  priceComparison: priceComparisonTool,
  // Operations Tools
  getDocuments: getDocumentsTool,
  getInboxItems: getInboxItemsTool,
  getAccountBalances: getAccountBalancesTool,
  getInboxStats: getInboxStatsTool,
  processInboxItem: processInboxItemTool,
  // Time Tracking Tools
  getTimeEntries: getTimeEntriesTool,
  getProjectTime: getProjectTimeTool,
  getTeamUtilization: getTeamUtilizationTool,
  getTimeStats: getTimeStatsTool,
  // Transactions Tools
  getTransactions: getTransactionsTool,
  searchTransactions: searchTransactionsTool,
  getTransactionStats: getTransactionStatsTool,
  getRecurringTransactions: getRecurringTransactionsTool,
  getTransactionsByVendor: getTransactionsByVendorTool,
};

// Get tools for specific agent
function getAgentTools(agentName: string): ToolSet {
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
        createCustomer: tools.createCustomer,
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
    case "research":
      return {
        compareProducts: tools.compareProducts,
        analyzeAffordability: tools.analyzeAffordability,
        marketResearch: tools.marketResearch,
        priceComparison: tools.priceComparison,
        getProducts: tools.getProducts,
      };
    case "operations":
      return {
        getDocuments: tools.getDocuments,
        getInboxItems: tools.getInboxItems,
        getAccountBalances: tools.getAccountBalances,
        getInboxStats: tools.getInboxStats,
        processInboxItem: tools.processInboxItem,
      };
    case "timetracking":
      return {
        getTimeEntries: tools.getTimeEntries,
        getProjectTime: tools.getProjectTime,
        getTeamUtilization: tools.getTeamUtilization,
        getTimeStats: tools.getTimeStats,
      };
    case "transactions":
      return {
        getTransactions: tools.getTransactions,
        searchTransactions: tools.searchTransactions,
        getTransactionStats: tools.getTransactionStats,
        getRecurringTransactions: tools.getRecurringTransactions,
        getTransactionsByVendor: tools.getTransactionsByVendor,
      };
    default:
      return tools as unknown as ToolSet; // General agent gets all tools
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
        logger.info(
          {
            teamId: userContext.teamId,
            activeTenantId: auth.activeTenantId,
            companyId: auth.companyId,
            userId: auth.userId,
          },
          "[Chat] User context built"
        );

        // If AI provider is not configured, degrade gracefully instead of 500
        if (!process.env.OPENAI_API_KEY) {
          logger.warn("[Chat] OPENAI_API_KEY missing - returning fallback response");
          await saveChatMessage(chatId, { role: "user", content: message });
          const responseText =
            "AI servis trenutno nije konfigurisan. Molim kontaktirajte administratora ili pokušajte kasnije.";
          await saveChatMessage(chatId, { role: "assistant", content: responseText });
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
        }

        // Get chat history
        const history = await getChatHistory(chatId, 10);
        logger.info({ historyLength: history.length }, "[Chat] Got history");

        // Route to appropriate agent using triage agent
        logger.info("[Chat] Routing to agent...");
        let agentName = "general";
        try {
          const routing = await generateText({
            model: openai("gpt-4o-mini"),
            system: mainAgent.getSystemPrompt(appContext),
            messages: [{ role: "user", content: message }],
          });
          agentName = routing.text.trim() || "general";
        } catch (routingError) {
          logger.warn(
            { error: routingError },
            "[Chat] Routing failed, defaulting to general agent"
          );
          agentName = "general";
        }
        logger.info({ agentName }, "[Chat] Routed to agent");

        const selectedAgent = routeToAgent(agentName);
        const agentTools: ToolSet = getAgentTools(agentName);
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

        let responseText: string | undefined;
        try {
          const result = await generateText({
            model: openai("gpt-4o-mini"),
            system: selectedAgent.getSystemPrompt(appContext),
            messages,
            tools: agentTools,
            maxSteps: 5,
          });

          logger.info(
            {
              textLength: result.text?.length,
              toolCalls: result.toolCalls?.length,
              toolResults: result.toolResults?.length,
              steps: result.steps?.length,
            },
            "[Chat] Generation complete"
          );

          // Build response from text or tool results
          responseText = result.text;
          type ToolCallResult = { result?: string };
          type GenerationResult = {
            text?: string;
            toolResults?: ToolCallResult[];
            steps?: Array<{ toolResults?: ToolCallResult[] }>;
          };
          const gen = result as unknown as GenerationResult;
          if (!responseText && gen.toolResults && gen.toolResults.length > 0) {
            const lastToolResult = gen.toolResults[gen.toolResults.length - 1];
            if (lastToolResult && typeof lastToolResult.result === "string") {
              responseText = lastToolResult.result;
              logger.info("[Chat] Using tool result as response");
            }
          }
          if (!responseText && gen.steps && gen.steps.length > 0) {
            for (const step of gen.steps) {
              if (step.toolResults && step.toolResults.length > 0) {
                const toolResult = step.toolResults[step.toolResults.length - 1];
                if (toolResult && typeof toolResult.result === "string") {
                  responseText = toolResult.result;
                  logger.info("[Chat] Using step tool result as response");
                  break;
                }
              }
            }
          }
        } catch (generationError) {
          logger.error({ error: generationError }, "[Chat] Text generation failed");
          responseText =
            "Došlo je do greške pri generisanju odgovora. Molim pokušajte ponovo kasnije.";
        }

        if (!responseText) {
          logger.warn("[Chat] No response text generated");
          responseText = "I couldn't generate a response. Please try again.";
        }

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
    analytics:
      "Financial analysis, burn rate, runway, cash flow, forecasting, and business metrics",
    reports: "Generating reports, summaries, and dashboards",
    research: "Market research, product comparison, affordability analysis, pricing intelligence",
    operations: "Document management, inbox processing, account balances, OCR processing",
    timetracking: "Time entries, timesheets, project hours, team utilization, productivity",
    transactions: "Transaction history, payment search, spending analysis, recurring payments",
  };
  return descriptions[name] || "Specialized assistant";
}

export default chatRoutes;
