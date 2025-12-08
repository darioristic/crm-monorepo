"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/accounts/individuals">Individuals</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/accounts/organizations">Organizations</Link>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Individuals</h2>
              <Button asChild size="sm">
                <Link href="/dashboard/accounts/individuals">Open</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Manage individual customers (contacts). Create, edit, favorite and search.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Organizations</h2>
              <Button asChild size="sm">
                <Link href="/dashboard/accounts/organizations">Open</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Manage organizational customers (organizations). Create, edit, favorite and search.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
