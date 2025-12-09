"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Props = {
  type: string;
  name: string;
  description: string;
  settings: {
    channel: "in_app" | "email" | "push";
    enabled: boolean;
  }[];
};

export function NotificationSetting({ type, name, description, settings }: Props) {
  const queryClient = useQueryClient();

  const updateSetting = useMutation({
    mutationFn: async (variables: {
      notificationType: string;
      channel: "in_app" | "email" | "push";
      enabled: boolean;
    }) => {
      const { request } = await import("@/lib/api");
      const response = await request(`/api/v1/notification-settings`, {
        method: "PATCH",
        body: JSON.stringify(variables),
      });
      return response;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["notificationSettings", "getAll"],
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(["notificationSettings", "getAll"]);

      // Optimistically update the cache
      queryClient.setQueryData(["notificationSettings", "getAll"], (old: any) => {
        if (!old) return old;

        return old.map((notificationType: any) => {
          if (notificationType.type !== variables.notificationType) {
            return notificationType;
          }

          return {
            ...notificationType,
            settings: notificationType.settings.map((setting: any) => {
              if (setting.channel !== variables.channel) {
                return setting;
              }
              return {
                ...setting,
                enabled: variables.enabled,
              };
            }),
          };
        });
      });

      // Return a context object with the snapshotted value
      return { previousData };
    },
    onError: (_, __, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(["notificationSettings", "getAll"], context.previousData);
      }
      toast.error("Failed to update notification setting");
    },
    onSuccess: () => {
      toast.success("Notification setting updated");
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({
        queryKey: ["notificationSettings", "getAll"],
      });
    },
  });

  const onChange = (channel: "in_app" | "email" | "push", newEnabled: boolean) => {
    updateSetting.mutate({
      notificationType: type,
      channel,
      enabled: newEnabled,
    });
  };

  const getSettingByChannel = (channel: "in_app" | "email" | "push") => {
    return settings.find((s) => s.channel === channel);
  };

  return (
    <div className="border-b-[1px] pb-4 mb-4">
      <div className="flex items-start justify-between">
        {/* Left side - Name and Description */}
        <div className="flex-1 pr-8">
          <Label className="text-sm font-medium">{name}</Label>
          <p className="text-sm text-[#606060] mt-1">{description}</p>
        </div>

        <div className="flex gap-8 items-center">
          {/* In-App Checkbox */}
          {getSettingByChannel("in_app") && (
            <div className="flex flex-col items-center space-y-2">
              <Label htmlFor={`${type}-in_app`} className="text-xs font-medium text-[#606060]">
                In-app
              </Label>
              <Checkbox
                id={`${type}-in_app`}
                checked={getSettingByChannel("in_app")?.enabled ?? false}
                onCheckedChange={(checked) => onChange("in_app", !!checked)}
              />
            </div>
          )}

          {getSettingByChannel("email") && (
            <div className="flex flex-col items-center space-y-2">
              <Label htmlFor={`${type}-email`} className="text-xs font-medium text-[#606060]">
                Email
              </Label>
              <Checkbox
                id={`${type}-email`}
                checked={getSettingByChannel("email")?.enabled ?? false}
                onCheckedChange={(checked) => onChange("email", !!checked)}
              />
            </div>
          )}

          {getSettingByChannel("push") && (
            <div className="flex flex-col items-center space-y-2">
              <Label htmlFor={`${type}-push`} className="text-xs font-medium text-[#606060]">
                Push
              </Label>
              <Checkbox
                id={`${type}-push`}
                checked={getSettingByChannel("push")?.enabled ?? false}
                onCheckedChange={(checked) => onChange("push", !!checked)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
