"use client";

import { Inbox, Mail, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  onUpload: () => void;
  onConnectEmail: () => void;
};

export function InboxEmpty({ onUpload, onConnectEmail }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="max-w-lg text-center">
        {/* Icon */}
        <div className="relative mb-6">
          <div className="h-20 w-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Inbox className="h-10 w-10 text-primary" />
          </div>
          <div className="absolute -top-1 -right-1 h-6 w-6 bg-yellow-500 rounded-full flex items-center justify-center">
            <Zap className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold mb-2">Magic Inbox</h2>
        <p className="text-muted-foreground mb-8">
          Automatically match your invoices, receipts, and expenses with bank transactions. Upload
          files or connect your email to get started.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="text-left">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">AI-Powered Matching</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Our AI automatically matches documents to your transactions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-left">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Email Integration</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connect Gmail to auto-import invoices and receipts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-left">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Upload className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Drag & Drop Upload</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload PDFs and images directly to your inbox
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="text-left">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 bg-orange-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Inbox className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Smart Organization</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically extract amounts, dates, and vendor info
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onUpload} size="lg">
            <Upload className="mr-2 h-4 w-4" />
            Upload Documents
          </Button>
          <Button onClick={onConnectEmail} variant="outline" size="lg">
            <Mail className="mr-2 h-4 w-4" />
            Connect Email
          </Button>
        </div>
      </div>
    </div>
  );
}

// Simple "no results" empty state for filtered views - Midday style
export function InboxNoResults() {
  return (
    <div className="h-screen -mt-[140px] w-full flex items-center justify-center flex-col">
      <div className="flex flex-col items-center">
        <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
        <div className="text-center mb-6 space-y-2">
          <h2 className="font-medium text-lg">No results</h2>
          <p className="text-[#606060] text-sm">Try another search term</p>
        </div>

        <Button variant="outline" onClick={() => (window.location.href = "/dashboard/inbox")}>
          Clear search
        </Button>
      </div>
    </div>
  );
}
