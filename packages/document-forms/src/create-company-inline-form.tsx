import { createCompanySchema } from "@crm/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { logger } from "./logger"; // TODO: Adjust path

export interface CreateCompanyInlineFormProps {
  onSuccess?: (companyId: string) => void;
  onCancel?: () => void;
}

type CompanyFormData = z.infer<typeof createCompanySchema>;

/**
 * CreateCompanyInlineForm Component
 *
 * Inline form for quickly creating a new company without leaving the current page.
 * TODO: Implement full form with validation and API integration
 */
export function CreateCompanyInlineForm({ onSuccess, onCancel }: CreateCompanyInlineFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(createCompanySchema),
  });

  const onSubmit = async (data: CompanyFormData) => {
    setIsSubmitting(true);
    try {
      // TODO: Call API to create company
      logger.info("Creating company:", data);

      // Mock success
      const mockCompanyId = "new-company-id";
      onSuccess?.(mockCompanyId);
    } catch (error) {
      logger.error("Failed to create company:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded border p-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Company Name *
        </label>
        <input
          id="name"
          type="text"
          {...register("name")}
          className="mt-1 w-full rounded border p-2"
          disabled={isSubmitting}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register("email")}
          className="mt-1 w-full rounded border p-2"
          disabled={isSubmitting}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded border px-4 py-2 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Creating..." : "Create Company"}
        </button>
      </div>
    </form>
  );
}
