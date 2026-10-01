"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { DropdownMenu } from "@/components/overlays/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/providers/toast-provider";

// Dev-only demo for /ui-kit: post options (FD-06 → FD-07) and the Me menu (GN-01), fake data.
export function MenuDemo() {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-muted">Post options</span>
        <DropdownMenu
          label="Post options"
          icon="more"
          items={[
            { label: "Edit post", icon: "pencil", onSelect: () => toast.show("Edit opens the post editor.", { tone: "info" }) },
            { label: "Report post", icon: "flag", onSelect: () => toast.show("Thanks for reporting. An admin will review it.") },
            { type: "separator" },
            { label: "Delete post", icon: "trash", destructive: true, onSelect: () => setDeleting(true) },
          ]}
        />
      </div>

      <DropdownMenu
        label="Me"
        header={
          <div className="flex items-center gap-3">
            <Avatar name="Mochi" alt="" size="lg" />
            <div className="flex min-w-0 flex-col">
              <span className="font-bold">Mochi</span>
              <span className="text-sm text-ink-muted">Aspin, Quezon City</span>
            </div>
          </div>
        }
        items={[
          { label: "My résumé", icon: "user", href: "/ui-kit" },
          { label: "Bookmarks", icon: "bookmark", href: "/ui-kit" },
          { label: "Invites to Apply", icon: "inbox", description: "2 new", href: "/ui-kit" },
          { label: "Design tokens", icon: "file", href: "/design-tokens" },
          { type: "separator" },
          { label: "Log out", icon: "log-out", onSelect: () => toast.show("Logged out (not really, it's a demo).", { tone: "info" }) },
        ]}
      >
        <Avatar name="Mochi" alt="" size="sm" />
        Me
      </DropdownMenu>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        destructive
        permanent
        title="Delete this post?"
        confirmLabel="Delete post"
        consequences={["The post and its photos are removed from the feed."]}
        onConfirm={() => toast.show("Post deleted.")}
      />
    </div>
  );
}
