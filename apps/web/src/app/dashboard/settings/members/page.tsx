"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { tenantAdminApi } from "@/lib/api";
import type { TenantUser, CreateTenantUserRequest } from "@/lib/api";

// Use workspace TenantUser type from API client

export default function MembersSettingsPage() {
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CreateTenantUserRequest["role"]>("crm_user");
  const [successMessage, setSuccessMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      const result = await tenantAdminApi.users.getAll();
      if (result.success) {
        setUsers(result.data ?? []);
      }
      setIsLoading(false);
    };
    run();
  }, []);

  const handleInvite = async () => {
    const result = await tenantAdminApi.users.create({
      firstName: "",
      lastName: "",
      email: inviteEmail,
      role: inviteRole,
    });
    if (result.success && result.data) {
      setSuccessMessage("Invitation sent");
      setInviteOpen(false);
      setInviteEmail("");
      const refresh = await tenantAdminApi.users.getAll();
      if (refresh.success) {
        setUsers(refresh.data ?? []);
      }
    }
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Members</h1>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>Invite</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
              <DialogDescription>Send an invitation to join this tenant</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select name="role" value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crm_user">Member</SelectItem>
                    <SelectItem value="tenant_admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" onClick={handleInvite}>
                  Send
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {successMessage && (
        <output className="text-sm text-green-600" aria-live="polite">
          {successMessage}
        </output>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} data-member>
                    <TableCell>
                      {`${u.firstName || ""} ${u.lastName || ""}`.trim() || "—"}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="capitalize">{u.role || "member"}</TableCell>
                    <TableCell>{u.status || "active"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-sm text-muted-foreground">No members yet</div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
