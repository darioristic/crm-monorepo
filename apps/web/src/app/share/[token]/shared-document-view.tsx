"use client";

import { format } from "date-fns";
import { Download, Eye, FileText, Lock } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocumentShare, DocumentWithTags } from "@/lib/api";

type Props = {
  token: string;
  document: DocumentWithTags | null;
  share: DocumentShare | null;
  requiresPassword: boolean;
  error: string | null;
};

export function SharedDocumentView({ token, document, share, requiresPassword, error }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    router.push(`/share/${token}?password=${encodeURIComponent(password)}`);
  };

  // Password required view
  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Password Protected</CardTitle>
            <CardDescription>This document requires a password to view</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Verifying..." : "View Document"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error view
  if (error || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Unable to Access Document</CardTitle>
            <CardDescription>{error || "The document could not be found"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const mimetype = document.metadata?.mimetype as string;
  const isPdf = mimetype === "application/pdf";
  const isImage = mimetype?.startsWith("image/");
  const downloadUrl = `/api/v1/public/document/${token}/download`;
  const viewUrl = `/api/v1/public/document/${token}/view`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">
                {document.title || document.metadata?.originalName || "Shared Document"}
              </h1>
              {document.summary && (
                <p className="text-sm text-muted-foreground line-clamp-1">{document.summary}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {share && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mr-4">
                <Eye className="h-4 w-4" />
                <span>{share.viewCount} views</span>
              </div>
            )}
            <Button asChild>
              <a href={downloadUrl} download>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Document Preview */}
      <main className="max-w-6xl mx-auto p-4">
        {isPdf ? (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <iframe
              src={viewUrl}
              className="w-full h-[calc(100vh-160px)] border-0"
              title={document.title || "Document Preview"}
            />
          </div>
        ) : isImage ? (
          <div className="bg-white rounded-lg shadow-sm p-4 flex justify-center">
            <Image
              src={viewUrl}
              alt={document.title || "Document"}
              width={800}
              height={600}
              className="max-w-full h-auto object-contain"
              unoptimized
            />
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold mb-2">
                {document.title || document.metadata?.originalName || "Document"}
              </h2>
              <p className="text-muted-foreground mb-4">Preview not available for this file type</p>
              <Button asChild>
                <a href={downloadUrl} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Document Info */}
        <div className="mt-4 bg-white rounded-lg shadow-sm p-4">
          <h3 className="font-medium mb-3">Document Details</h3>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {document.metadata?.originalName && (
              <div>
                <dt className="text-muted-foreground">File Name</dt>
                <dd className="font-medium">{document.metadata.originalName as string}</dd>
              </div>
            )}
            {document.metadata?.size && (
              <div>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="font-medium">{formatFileSize(document.metadata.size as number)}</dd>
              </div>
            )}
            {document.createdAt && (
              <div>
                <dt className="text-muted-foreground">Uploaded</dt>
                <dd className="font-medium">
                  {format(new Date(document.createdAt), "MMM d, yyyy")}
                </dd>
              </div>
            )}
            {share?.expiresAt && (
              <div>
                <dt className="text-muted-foreground">Link Expires</dt>
                <dd className="font-medium">{format(new Date(share.expiresAt), "MMM d, yyyy")}</dd>
              </div>
            )}
          </dl>
        </div>
      </main>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
