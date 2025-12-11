"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Loader2, Mail, MoreVertical, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inboxApi } from "@/lib/api/inbox";

// Gmail icon component
function GmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22 6L12 13L2 6V4L12 11L22 4V6Z" fill="currentColor" fillOpacity="0.8" />
      <path
        d="M2 6L12 13L22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6Z"
        fill="currentColor"
        fillOpacity="0.6"
      />
    </svg>
  );
}

export function InboxSettings() {
  const queryClient = useQueryClient();
  const [blocklistDialogOpen, setBlocklistDialogOpen] = useState(false);
  const [blocklistType, setBlocklistType] = useState<"email" | "domain">("email");
  const [blocklistValue, setBlocklistValue] = useState("");

  // Fetch connected accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["inbox-accounts"],
    queryFn: () => inboxApi.getAccounts(),
  });

  // Fetch blocklist
  const { data: blocklist, isLoading: blocklistLoading } = useQuery({
    queryKey: ["inbox-blocklist"],
    queryFn: () => inboxApi.getBlocklist(),
  });

  // Disconnect account mutation
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => inboxApi.disconnectAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-accounts"] });
      toast.success("Account disconnected");
    },
    onError: () => {
      toast.error("Failed to disconnect account");
    },
  });

  // Add to blocklist mutation
  const addToBlocklistMutation = useMutation({
    mutationFn: ({ type, value }: { type: "email" | "domain"; value: string }) =>
      inboxApi.addToBlocklist(type, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-blocklist"] });
      toast.success("Added to blocklist");
      setBlocklistDialogOpen(false);
      setBlocklistValue("");
    },
    onError: () => {
      toast.error("Failed to add to blocklist");
    },
  });

  // Remove from blocklist mutation
  const removeFromBlocklistMutation = useMutation({
    mutationFn: (id: string) => inboxApi.removeFromBlocklist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox-blocklist"] });
      toast.success("Removed from blocklist");
    },
    onError: () => {
      toast.error("Failed to remove from blocklist");
    },
  });

  const handleConnectGmail = () => {
    // In a real implementation, this would redirect to Gmail OAuth
    toast.info("Gmail connection will be available soon");
  };

  const handleAddToBlocklist = () => {
    if (!blocklistValue.trim()) {
      toast.error("Please enter a value");
      return;
    }
    addToBlocklistMutation.mutate({ type: blocklistType, value: blocklistValue.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Connected Email Accounts</CardTitle>
              <CardDescription>
                Connect your email to automatically import invoices and receipts
              </CardDescription>
            </div>
            <Button onClick={handleConnectGmail} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Connect Gmail
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : !accounts || accounts.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No email accounts connected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Connect Gmail to automatically import invoices
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    {account.provider === "gmail" ? (
                      <GmailIcon className="h-5 w-5" />
                    ) : (
                      <Mail className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{account.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Last synced{" "}
                      {formatDistanceToNow(new Date(account.lastAccessed), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <Badge
                    variant={account.status === "active" ? "default" : "destructive"}
                    className="capitalize"
                  >
                    {account.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toast.info("Sync coming soon")}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync Now
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => disconnectMutation.mutate(account.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Disconnect
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Blocklist</CardTitle>
              <CardDescription>
                Block specific emails or domains from being imported
              </CardDescription>
            </div>
            <Dialog open={blocklistDialogOpen} onOpenChange={setBlocklistDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add to Blocklist
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add to Blocklist</DialogTitle>
                  <DialogDescription>
                    Block emails from a specific address or entire domain
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex gap-2">
                    <Button
                      variant={blocklistType === "email" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBlocklistType("email")}
                    >
                      Email Address
                    </Button>
                    <Button
                      variant={blocklistType === "domain" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBlocklistType("domain")}
                    >
                      Domain
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blocklist-value">
                      {blocklistType === "email" ? "Email Address" : "Domain"}
                    </Label>
                    <Input
                      id="blocklist-value"
                      placeholder={blocklistType === "email" ? "spam@example.com" : "example.com"}
                      value={blocklistValue}
                      onChange={(e) => setBlocklistValue(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBlocklistDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddToBlocklist}
                    disabled={addToBlocklistMutation.isPending}
                  >
                    {addToBlocklistMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {blocklistLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !blocklist || blocklist.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No blocked addresses or domains</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add emails or domains you want to block
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocklist.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.value}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromBlocklistMutation.mutate(item.id)}
                        disabled={removeFromBlocklistMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
