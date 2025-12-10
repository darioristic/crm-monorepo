"use client";

import { InviteForm } from "@/components/forms/invite-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InviteTeamMembersModalProps = {
  onOpenChange: (open: boolean) => void;
  isOpen?: boolean;
};

export function InviteTeamMembersModal({
  onOpenChange,
  isOpen = false,
}: InviteTeamMembersModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[455px]">
        <div className="p-4">
          <DialogHeader>
            <DialogTitle>Invite Members</DialogTitle>
            <DialogDescription>Invite new members by email address.</DialogDescription>
          </DialogHeader>

          <InviteForm onSuccess={() => onOpenChange(false)} skippable={false} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
