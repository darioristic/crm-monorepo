"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";

export function UserAvatar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const updateUserMutation = useMutation({
    mutationFn: async (avatarUrl: string) => {
      // Call API to update user avatar
      const response = await fetch("/api/v1/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatarUrl }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to update avatar");
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      await refreshUser();
      toast.success("Avatar updated");
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update avatar");
      setIsUploading(false);
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setIsUploading(true);

    // Convert to base64 for now (in production, upload to S3/storage)
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      updateUserMutation.mutate(base64String);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (!user) {
    return null;
  }

  return (
    <Card>
      <div className="flex justify-between items-center pr-6">
        <CardHeader>
          <CardTitle>Avatar</CardTitle>
          <CardDescription>
            This is your avatar. Click on the avatar to upload a custom one from your files.
          </CardDescription>
        </CardHeader>

        <Avatar
          className="w-16 h-16 rounded-full cursor-pointer border-2 border-border hover:border-primary transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          {isUploading || updateUserMutation.isPending ? (
            <div className="flex items-center justify-center w-full h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {user.avatarUrl && (
                <AvatarImage src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} />
              )}
              <AvatarFallback className="bg-muted text-lg font-medium">
                {user.firstName?.charAt(0)?.toUpperCase()}
                {user.lastName?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            style={{ display: "none" }}
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isUploading || updateUserMutation.isPending}
          />
        </Avatar>
      </div>
      <CardFooter>An avatar is optional but strongly recommended.</CardFooter>
    </Card>
  );
}
