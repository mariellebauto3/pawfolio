"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { saveFile } from "@/lib/utils/save-file";
import { useToast } from "@/providers/toast-provider";
import { downloadActivityLogs, downloadMyActivity } from "../api/activity-logs";
import { type LogFilters, exportFileName } from "../schemas/activity-logs";
import type { ActivityType } from "../types/activity-logs";

type Props =
  | { scope: "mine"; /** The types the list shows now; the file holds the same. */ types: readonly ActivityType[]; label?: string }
  | { scope: "all"; /** The filters the list shows now; the file holds the same. */ filters: LogFilters; label?: string };

// "Download CSV" (LG-01, LG-02) and "Export CSV" (LG-03): what the list shows, as a file. It is read with the
// reader's own session through `api.getFile`, which accepts a CSV and nothing else, and handed to the browser as a
// download, never opened as a page (SEC-FE-09). What the file may contain is the API's to decide: a member's has
// no reasons and names no admin.
export function DownloadCsvButton(props: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const file = props.scope === "mine" ? await downloadMyActivity(api, props.types) : await downloadActivityLogs(api, props.filters);
      saveFile(file, exportFileName(props.scope));
      toast.show("The CSV file was downloaded.");
    } catch (problem) {
      toast.show(isApiError(problem) ? problem.message : "We couldn't make the file. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="tertiary" loading={busy} loadingLabel="Making the file" onClick={download}>
      {props.label ?? "Download CSV"}
    </Button>
  );
}
