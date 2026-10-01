"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/providers/toast-provider";

// Dev-only demo for /ui-kit: toasts in each tone.
export function ToastDemo() {
  const toast = useToast();

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => toast.show("Saved to Bookmarks.")}>Bookmark Mochi</Button>
      <Button onClick={() => toast.show("Invite to Apply sent. You'll be notified if Mochi applies.", { tone: "info" })}>
        Send an invite
      </Button>
      <Button onClick={() => toast.show("Couldn't send your request. Check your connection and try again.", { tone: "error" })}>
        Fail to send
      </Button>
    </div>
  );
}
