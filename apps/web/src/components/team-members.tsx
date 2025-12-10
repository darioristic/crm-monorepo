"use client";

import { Suspense } from "react";
import { DataTable as MembersTable } from "@/components/tables/members";
import { DataTable as PendingInvitesTable } from "@/components/tables/pending-invites";
import { PendingInvitesSkeleton } from "@/components/tables/pending-invites/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TeamMembers() {
  return (
    <Tabs defaultValue="members" className="w-full">
      <TabsList className="bg-transparent border-b w-full justify-start rounded-none mb-6 p-0 h-auto">
        <TabsTrigger
          value="members"
          className="px-4 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
        >
          Team Members
        </TabsTrigger>
        <TabsTrigger
          value="pending"
          className="px-4 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
        >
          Pending Invitations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="mt-0">
        <Suspense fallback={<PendingInvitesSkeleton />}>
          <MembersTable />
        </Suspense>
      </TabsContent>

      <TabsContent value="pending" className="mt-0">
        <Suspense fallback={<PendingInvitesSkeleton />}>
          <PendingInvitesTable />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
