import { z } from "zod";

/**
 * Company Creation Schema
 * Basic validation for company creation forms
 */
export const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  email: z.string().email("Invalid email address").optional(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
  note: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
