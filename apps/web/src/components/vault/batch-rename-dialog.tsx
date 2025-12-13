"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { documentsApi } from "@/lib/api";

type Props = {
  documentIds: string[];
  onComplete?: () => void;
  trigger?: React.ReactNode;
};

export function BatchRenameDialog({ documentIds, onComplete, trigger }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [pattern, setPattern] = useState("{name}");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [startNumber, setStartNumber] = useState(1);
  const [preserveExtension, setPreserveExtension] = useState(true);

  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: () =>
      documentsApi.batchRename({
        documentIds,
        pattern,
        options: {
          prefix: prefix || undefined,
          suffix: suffix || undefined,
          startNumber,
          preserveExtension,
        },
      }),
    onSuccess: (result) => {
      if (result.data) {
        const { renamed, failed } = result.data;
        if (renamed.length > 0) {
          toast.success(`Renamed ${renamed.length} document(s)`);
        }
        if (failed.length > 0) {
          toast.error(`Failed to rename ${failed.length} document(s)`);
        }
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        setIsOpen(false);
        onComplete?.();
      }
    },
    onError: () => {
      toast.error("Failed to rename documents");
    },
  });

  const previewName = () => {
    let preview = pattern
      .replace("{name}", "Document")
      .replace("{n}", String(startNumber))
      .replace("{N}", String(startNumber).padStart(3, "0"))
      .replace("{date}", new Date().toISOString().split("T")[0]);
    preview = `${prefix}${preview}${suffix}`;
    if (preserveExtension) {
      preview += ".pdf";
    }
    return preview;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Batch Rename</DialogTitle>
          <DialogDescription>
            Rename {documentIds.length} document(s) using a pattern. Use placeholders:
            <br />
            <code className="text-xs">{"{name}"}</code> - original name,{" "}
            <code className="text-xs">{"{n}"}</code> - number,{" "}
            <code className="text-xs">{"{N}"}</code> - padded number,{" "}
            <code className="text-xs">{"{date}"}</code> - today
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="pattern">Pattern</Label>
            <Input
              id="pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="{name}"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="prefix">Prefix</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Optional prefix"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="suffix">Suffix</Label>
              <Input
                id="suffix"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="Optional suffix"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="startNumber">Start Number</Label>
            <Input
              id="startNumber"
              type="number"
              min={1}
              value={startNumber}
              onChange={(e) => setStartNumber(parseInt(e.target.value, 10) || 1)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Preserve Extension</Label>
              <p className="text-xs text-muted-foreground">Keep original file extension</p>
            </div>
            <Switch checked={preserveExtension} onCheckedChange={setPreserveExtension} />
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <Label className="text-xs text-muted-foreground">Preview</Label>
            <p className="font-mono text-sm mt-1">{previewName()}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => renameMutation.mutate()} disabled={renameMutation.isPending}>
            {renameMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Rename {documentIds.length} File(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
