"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Dev-only demo for /ui-kit: shows the loading state for two seconds.
export function LoadingButtonDemo() {
  const [loading, setLoading] = useState(false);

  function send() {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  }

  return (
    <Button variant="primary" loading={loading} loadingLabel="Sending request" onClick={send}>
      {loading ? "Sending request" : "Send request"}
    </Button>
  );
}
