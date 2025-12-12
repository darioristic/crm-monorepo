"use server";

import { tool } from "ai";
import { z } from "zod";
import { sql } from "../../db/client";
import { createCompany } from "../../db/queries/companies-members";

const createCustomerSchema = z.object({
  tenantId: z.string().describe("The tenant ID (use tenant_id from context)"),
  name: z.string().min(2).describe("Customer/company name"),
  address: z.string().min(5).describe("Full address"),
  industry: z.string().default("Consulting").describe("Industry name"),
  vatNumber: z.string().optional().describe("VAT number (PIB)"),
  companyNumber: z.string().optional().describe("Company registration number (matični broj)"),
  email: z.string().email().optional().describe("Contact email"),
  phone: z.string().optional().describe("Contact phone"),
  website: z.string().url().optional().describe("Website URL"),
  city: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  note: z.string().optional(),
});

type CreateCustomerParams = z.infer<typeof createCustomerSchema>;

export const createCustomerTool = tool({
  description:
    "Create a new customer (company) in the current tenant. Use when the requested customer doesn't exist.",
  parameters: createCustomerSchema,
  execute: async (params: CreateCustomerParams): Promise<string> => {
    const {
      tenantId,
      name,
      address,
      industry,
      email,
      phone,
      website,
      city,
      zip,
      country,
      countryCode,
      vatNumber,
      companyNumber,
      note,
    } = params;

    try {
      // Pick a user from this tenant to act as creator
      const users = await sql`
        SELECT u.id 
        FROM users u
        JOIN user_tenant_roles utr ON u.id = utr.user_id
        WHERE utr.tenant_id = ${tenantId}
        LIMIT 1
      `;

      if (users.length === 0) {
        return "❌ No users found in this tenant to assign as creator.";
      }
      const userId = users[0].id as string;

      const companyId = await createCompany({
        name,
        industry,
        address,
        userId,
        email,
        phone,
        website,
        contact: undefined,
        city,
        zip,
        country,
        countryCode,
        vatNumber,
        companyNumber,
        note,
        logoUrl: undefined,
        switchCompany: false,
        source: "customer",
      });

      return `✅ Customer created:\n- ID: ${companyId}\n- Name: ${name}\n- Address: ${address}\n${
        vatNumber ? `- VAT (PIB): ${vatNumber}\n` : ""
      }${companyNumber ? `- Company No.: ${companyNumber}\n` : ""}`;
    } catch (error) {
      return `❌ Failed to create customer: ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
    }
  },
});
