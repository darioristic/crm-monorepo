"use client";

import type { Company, Invoice } from "@crm/types";
import { format } from "date-fns";
import { MoreHorizontal, MoreVertical } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormatAmount } from "@/components/format-amount";
import { InvoiceStatus } from "@/components/invoice/invoice-status";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SheetFooter } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompanyParams } from "@/hooks/use-company-params";
import { companiesApi, invoicesApi } from "@/lib/api";

interface InvoiceSummary {
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  invoiceCount: number;
  currency: string;
}

export function CompanyDetails() {
  const router = useRouter();
  const _pathname = usePathname();
  const { companyId, setParams } = useCompanyParams();
  const [company, setCompany] = useState<Company | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);

  const _isOpen = companyId !== null;

  // Fetch company details
  useEffect(() => {
    if (!companyId) {
      setCompany(null);
      return;
    }

    const fetchCompany = async () => {
      setIsLoading(true);
      try {
        const result = await companiesApi.getById(companyId);
        if (result.success && result.data) {
          setCompany(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch company:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompany();
  }, [companyId]);

  // Fetch invoices for this company
  useEffect(() => {
    if (!companyId) {
      setInvoices([]);
      return;
    }

    const fetchInvoices = async () => {
      setIsLoadingInvoices(true);
      try {
        const result = await invoicesApi.getAll({
          companyId,
          pageSize: 100,
        });
        if (result.success && result.data) {
          // Filter invoices to only show those for this specific company
          const filteredInvoices = result.data.filter((inv) => inv.companyId === companyId);
          setInvoices(filteredInvoices);
        }
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      } finally {
        setIsLoadingInvoices(false);
      }
    };

    fetchInvoices();
  }, [companyId]);

  // Calculate invoice summary
  const summary: InvoiceSummary = useMemo(() => {
    const result = {
      totalAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      invoiceCount: invoices.length,
      currency: "EUR",
    };

    for (const invoice of invoices) {
      const total = invoice.total || 0;
      const paid = invoice.paidAmount || 0;
      result.totalAmount += total;
      result.paidAmount += paid;
      result.outstandingAmount += total - paid;
      if (invoice.currency) {
        result.currency = invoice.currency;
      }
    }

    return result;
  }, [invoices]);

  const handleEdit = () => {
    setParams({ companyId: companyId!, details: null });
  };

  const handleOpenInvoice = (invoiceId: string) => {
    // Close company details sheet and open invoice
    setParams({ companyId: null, details: null });
    router.push(`/dashboard/sales/invoices?type=edit&invoiceId=${invoiceId}`);
  };

  const handleCreateInvoice = () => {
    // Close company details sheet and create new invoice with company pre-selected
    setParams({ companyId: null, details: null });
    router.push(`/dashboard/sales/invoices?type=create&customerId=${companyId}`);
  };

  if (isLoading) {
    return (
      <div className="h-full px-6 pt-6 pb-6">
        <Skeleton className="h-6 w-48 mb-6" />
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-4 w-32 mb-4" />
      </div>
    );
  }

  if (!company) {
    return null;
  }

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "MMM d");
    } catch {
      return "-";
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden -mx-6">
      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Sticky Company Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4">
          <div className="text-[24px] font-serif leading-normal">{company.name}</div>
        </div>

        <div className="px-6 pb-4 pt-2">
          <Accordion type="multiple" defaultValue={["general", "details"]} className="space-y-0">
            {/* General Section */}
            <AccordionItem value="general" className="border-b border-border">
              <AccordionTrigger className="text-[16px] font-medium py-4">General</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-4 pt-0">
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">Contact person</div>
                    <div className="text-[14px]">
                      {company.contact || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">Email</div>
                    <div className="text-[14px]">
                      {company.email || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">Billing Email</div>
                    <div className="text-[14px]">
                      {(company as Company & { billingEmail?: string }).billingEmail || (
                        <span className="text-[#606060]">-</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">Phone</div>
                    <div className="text-[14px]">
                      {company.phone || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">Website</div>
                    <div className="text-[14px]">
                      {company.website || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Details Section */}
            <AccordionItem value="details" className="border-b border-border">
              <AccordionTrigger className="text-[16px] font-medium py-4">Details</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-4 pt-0">
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">Address</div>
                    <div className="text-[14px]">
                      {company.address || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">City</div>
                    <div className="text-[14px]">
                      {company.city || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">ZIP Code</div>
                    <div className="text-[14px]">
                      {company.zip || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">Country</div>
                    <div className="text-[14px]">
                      {company.country || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">VAT Number</div>
                    <div className="text-[14px]">
                      {company.vatNumber || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] mb-2 text-[#606060]">Industry</div>
                    <div className="text-[14px]">
                      {company.industry || <span className="text-[#606060]">-</span>}
                    </div>
                  </div>
                  {company.note && (
                    <div className="col-span-2">
                      <div className="text-[12px] mb-2 text-[#606060]">Note</div>
                      <div className="text-[14px]">{company.note}</div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Statement Section */}
          <div className="border-t border-border pt-6 mt-6">
            {/* Statement Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[16px] font-medium">Statement</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="p-0 h-6 w-6">
                    <MoreVertical size={15} className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[100]">
                  <DropdownMenuItem className="text-xs">Download</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-border px-4 py-3">
                <div className="text-[12px] text-[#606060] mb-2">Total Amount</div>
                <div className="text-[18px] font-medium">
                  <FormatAmount amount={summary.totalAmount} currency={summary.currency} />
                </div>
              </div>
              <div className="border border-border px-4 py-3">
                <div className="text-[12px] text-[#606060] mb-2">Paid</div>
                <div className="text-[18px] font-medium">
                  <FormatAmount amount={summary.paidAmount} currency={summary.currency} />
                </div>
              </div>
              <div className="border border-border px-4 py-3">
                <div className="text-[12px] text-[#606060] mb-2">Outstanding</div>
                <div className="text-[18px] font-medium">
                  <FormatAmount amount={summary.outstandingAmount} currency={summary.currency} />
                </div>
              </div>
              <div className="border border-border px-4 py-3">
                <div className="text-[12px] text-[#606060] mb-2">Invoices</div>
                <div className="text-[18px] font-medium">{summary.invoiceCount}</div>
              </div>
            </div>

            {/* Invoice Table */}
            {isLoadingInvoices ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : invoices.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[12px] font-medium text-[#606060]">
                      Invoice
                    </TableHead>
                    <TableHead className="text-[12px] font-medium text-[#606060]">Date</TableHead>
                    <TableHead className="text-[12px] font-medium text-[#606060]">
                      Due Date
                    </TableHead>
                    <TableHead className="text-[12px] font-medium text-[#606060]">Amount</TableHead>
                    <TableHead className="text-[12px] font-medium text-[#606060]">Status</TableHead>
                    <TableHead className="text-[12px] font-medium text-[#606060] text-center w-[60px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenInvoice(invoice.id)}
                    >
                      <TableCell className="text-[12px] whitespace-nowrap min-w-[100px]">
                        {invoice.invoiceNumber || "Draft"}
                      </TableCell>
                      <TableCell className="text-[12px] whitespace-nowrap">
                        {formatDate(invoice.issueDate)}
                      </TableCell>
                      <TableCell className="text-[12px] whitespace-nowrap">
                        {formatDate(invoice.dueDate)}
                      </TableCell>
                      <TableCell className="text-[12px] whitespace-nowrap">
                        <FormatAmount
                          amount={invoice.total || 0}
                          currency={invoice.currency || "EUR"}
                        />
                      </TableCell>
                      <TableCell className="text-[12px] whitespace-nowrap">
                        <InvoiceStatus
                          status={
                            invoice.status as
                              | import("@/components/invoice/invoice-status").InvoiceStatusType
                              | undefined
                          }
                          className="text-xs"
                          textOnly
                        />
                      </TableCell>
                      <TableCell className="text-center w-[60px]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="text-[#606060] hover:text-foreground transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-[100]">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInvoice(invoice.id);
                              }}
                            >
                              View
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center">
                  <div className="text-center mb-6 space-y-2">
                    <h2 className="font-medium text-sm">No invoices</h2>
                    <p className="text-[#606060] text-xs">
                      This company doesn't have any invoices yet. <br />
                      Create your first invoice for them.
                    </p>
                  </div>

                  <Button variant="outline" onClick={handleCreateInvoice}>
                    Create Invoice
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      <SheetFooter className="border-t border-border pt-4 mt-auto flex-shrink-0 w-full mx-0">
        <div className="w-full px-6 flex justify-end">
          <Button onClick={handleEdit} variant="secondary" className="rounded-none">
            Edit
          </Button>
        </div>
      </SheetFooter>
    </div>
  );
}
