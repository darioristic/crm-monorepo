"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Company, CreateCompanyRequest, UpdateCompanyRequest } from "@crm/types";
import { companiesApi } from "@/lib/api";
import { useMutation } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

const industries = [
  "Technology",
  "Finance",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Education",
  "Real Estate",
  "Transportation",
  "Energy",
  "Media",
  "Telecommunications",
  "Agriculture",
  "Construction",
  "Hospitality",
  "Other",
];

const companyFormSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  industry: z.string().min(1, "Please select an industry"),
  address: z.string().min(5, "Address must be at least 5 characters"),
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

interface CompanyFormProps {
  company?: Company;
  mode: "create" | "edit";
}

export function CompanyForm({ company, mode }: CompanyFormProps) {
  const router = useRouter();

  const createMutation = useMutation<Company, CreateCompanyRequest>((data) =>
    companiesApi.create(data)
  );

  const updateMutation = useMutation<Company, UpdateCompanyRequest>((data) =>
    companiesApi.update(company?.id || "", data)
  );

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema) as any,
    defaultValues: {
      name: company?.name || "",
      industry: company?.industry || "",
      address: company?.address || "",
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        industry: company.industry,
        address: company.address,
      });
    }
  }, [company, form]);

  const onSubmit = async (values: CompanyFormValues) => {
    let result;
    if (mode === "create") {
      result = await createMutation.mutate(values as CreateCompanyRequest);
    } else {
      result = await updateMutation.mutate(values as UpdateCompanyRequest);
    }

    if (result.success) {
      router.push("/dashboard/companies");
      router.refresh();
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;
  const error = createMutation.error || updateMutation.error;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{mode === "create" ? "Create Company" : "Edit Company"}</CardTitle>
        <CardDescription>
          {mode === "create"
            ? "Add a new company to your CRM system"
            : "Update company information"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corporation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="123 Business Street, Suite 100, City, Country"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Create Company" : "Update Company"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

