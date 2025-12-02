import { tool } from "ai";
import { z } from "zod";
import { companyQueries } from "../../db/queries/companies";
import type { ToolResponse } from "../types";

const getCustomersSchema = z.object({
  pageSize: z.number().min(1).max(50).default(10).describe("Number of customers to return"),
  search: z.string().optional().describe("Search by name, industry, city, or country"),
  industry: z.string().optional().describe("Filter by industry"),
  country: z.string().optional().describe("Filter by country"),
});

type GetCustomersParams = z.infer<typeof getCustomersSchema>;

export const getCustomersTool = tool({
  description: "Search and retrieve customers (companies) with filtering options",
  parameters: getCustomersSchema,
  execute: async (params: GetCustomersParams): Promise<ToolResponse> => {
    const { pageSize = 10, search, industry, country } = params;
    try {
      let result;

      if (industry) {
        const companies = await companyQueries.findByIndustry(industry);
        result = { data: companies.slice(0, pageSize), total: companies.length };
      } else if (country) {
        const companies = await companyQueries.findByCountry(country);
        result = { data: companies.slice(0, pageSize), total: companies.length };
      } else {
        result = await companyQueries.findAll(
          { page: 1, pageSize },
          { search }
        );
      }

      if (result.data.length === 0) {
        return { text: "No customers found matching your criteria." };
      }

      const tableRows = result.data
        .map((company) => {
          const location = [company.city, company.country].filter(Boolean).join(", ") || "N/A";
          return `| ${company.name} | ${company.industry || "N/A"} | ${location} | ${company.email || "N/A"} |`;
        })
        .join("\n");

      const response = `| Company Name | Industry | Location | Email |
|--------------|----------|----------|-------|
${tableRows}

**Found ${result.total} customers**`;

      return {
        text: response,
        link: {
          text: "View all customers",
          url: "/dashboard/crm/companies",
        },
      };
    } catch (error) {
      return {
        text: `Failed to retrieve customers: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

const getCustomerByIdSchema = z.object({
  customerId: z.string().describe("The customer/company ID"),
});

type GetCustomerByIdParams = z.infer<typeof getCustomerByIdSchema>;

export const getCustomerByIdTool = tool({
  description: "Get detailed information about a specific customer by ID",
  parameters: getCustomerByIdSchema,
  execute: async (params: GetCustomerByIdParams): Promise<ToolResponse> => {
    const { customerId } = params;
    try {
      const company = await companyQueries.findById(customerId);

      if (!company) {
        return { text: `Customer with ID ${customerId} not found.` };
      }

      const details = [
        `**${company.name}**`,
        "",
        `- **Industry**: ${company.industry || "Not specified"}`,
        `- **Address**: ${company.address || "N/A"}`,
        company.city && `- **City**: ${company.city}`,
        company.country && `- **Country**: ${company.country}`,
        company.email && `- **Email**: ${company.email}`,
        company.phone && `- **Phone**: ${company.phone}`,
        company.website && `- **Website**: ${company.website}`,
        company.vatNumber && `- **VAT Number**: ${company.vatNumber}`,
        company.note && `\n**Notes**: ${company.note}`,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        text: details,
        link: {
          text: "View customer details",
          url: `/dashboard/crm/companies/${customerId}`,
        },
      };
    } catch (error) {
      return {
        text: `Failed to retrieve customer: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

const emptySchema = z.object({});
type EmptyParams = z.infer<typeof emptySchema>;

export const getIndustriesSummaryTool = tool({
  description: "Get a summary of customers grouped by industry",
  parameters: emptySchema,
  execute: async (_params: EmptyParams): Promise<ToolResponse> => {
    try {
      const industries = await companyQueries.getIndustries();
      const totalCustomers = await companyQueries.count();

      if (industries.length === 0) {
        return { text: "No industry data available." };
      }

      const industryList = industries.map((ind) => `- ${ind}`).join("\n");

      const response = `**Customer Industries Overview**

Total Customers: ${totalCustomers}
Industries: ${industries.length}

${industryList}`;

      return {
        text: response,
        link: {
          text: "View customers by industry",
          url: "/dashboard/crm/companies",
        },
      };
    } catch (error) {
      return {
        text: `Failed to retrieve industries: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
