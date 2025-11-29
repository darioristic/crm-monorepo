"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { TopCustomer } from "@crm/types";

interface TopCustomersTableProps {
  data: TopCustomer[];
  className?: string;
}

export function TopCustomersTable({ data, className }: TopCustomersTableProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Top Customers</CardTitle>
        <CardDescription>Best performing customers by revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
              <TableHead className="text-center">Quotes</TableHead>
              <TableHead>Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((customer, index) => (
              <TableRow key={customer.companyId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {index + 1}
                    </div>
                    <span className="font-medium">{customer.companyName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {customer.industry && (
                    <Badge variant="outline">{customer.industry}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  €{customer.totalRevenue.toLocaleString()}
                </TableCell>
                <TableCell className="text-center">{customer.invoiceCount}</TableCell>
                <TableCell className="text-center">{customer.quoteCount}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={customer.conversionRate} className="h-2 w-16" />
                    <span className="text-sm text-muted-foreground">
                      {customer.conversionRate.toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

