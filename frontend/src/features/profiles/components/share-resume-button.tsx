"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/providers/toast-provider";

type Props = {
  /** The resume's public path, e.g. "/pets/1". */
  path: string;
};

// "Share" on My resume (PR-01): copies the link to the pet's public resume.
export function ShareResumeButton({ path }: Props) {
  const toast = useToast();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      toast.show("Link copied. Paste it anywhere to share your resume.");
    } catch {
      toast.show("We couldn't copy the link. Copy it from the address bar of your public resume.", { tone: "error" });
    }
  }

  return (
    <Button variant="tertiary" onClick={() => void copyLink()}>
      Share
    </Button>
  );
}
