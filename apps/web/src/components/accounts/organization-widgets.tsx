"use client";

import type { CustomerOrganization } from "@crm/types";
import { Building2, Star, TrendingUp, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWebsiteLogo } from "@/lib/logos";

type Props = {
  organizations: CustomerOrganization[];
  isLoading?: boolean;
};

export function OrganizationWidgets({ organizations, isLoading }: Props) {
  // Calculate stats
  const totalCount = organizations.length;
  const favoritesCount = organizations.filter((o) => o.isFavorite).length;

  // Get organizations created this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = organizations.filter((o) => {
    const created = new Date(o.createdAt);
    return created >= startOfMonth;
  }).length;

  // Get top organization (most recent favorite or first one)
  const topOrg = organizations.find((o) => o.isFavorite) || organizations[0];

  // Get popular tags
  const tagCounts: Record<string, number> = {};
  organizations.forEach((org) => {
    org.tags?.forEach((tag) => {
      tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1;
    });
  });
  const _topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {["one", "two", "three", "four"].map((key) => (
          <Card key={key} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCount}</div>
          <p className="text-xs text-muted-foreground">
            {newThisMonth > 0 ? `+${newThisMonth} this month` : "No new this month"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Favorites</CardTitle>
          <Star className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{favoritesCount}</div>
          <p className="text-xs text-muted-foreground">
            {totalCount > 0
              ? `${Math.round((favoritesCount / totalCount) * 100)}% of total`
              : "No organizations yet"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">New This Month</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{newThisMonth}</div>
          <p className="text-xs text-muted-foreground">
            Added since{" "}
            {startOfMonth.toLocaleDateString("sr-RS", { month: "short", day: "numeric" })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Featured</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {topOrg ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={topOrg.logoUrl || (topOrg.website ? getWebsiteLogo(topOrg.website) : "")}
                  alt={topOrg.name}
                />
                <AvatarFallback className="text-xs">
                  {topOrg.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium truncate max-w-[120px]">{topOrg.name}</span>
                {topOrg.city && (
                  <span className="text-xs text-muted-foreground">{topOrg.city}</span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No organizations yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
