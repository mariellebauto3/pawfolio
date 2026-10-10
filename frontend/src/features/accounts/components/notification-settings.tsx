"use client";

import { useState } from "react";
import { Toggle } from "@/components/forms/toggle";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import { updateNotificationPreference } from "../api/settings";
import { NOTIFICATION_LABELS } from "../schemas/accounts";
import { NOTIFICATION_PREFERENCES, type NotificationPreference, type NotificationPreferences } from "../types/accounts";

type Props = {
  preferences: NotificationPreferences;
};

// The notification switches of Settings (AC-01, AC-02). Each applies at once: it moves when pressed, the API is
// told, and it goes back if the API refuses, with a toast saying so. One switch at a time, so two quick presses
// can't finish in the wrong order.
export function NotificationSettings({ preferences }: Props) {
  const toast = useToast();
  const [values, setValues] = useState(preferences);
  const [saving, setSaving] = useState<NotificationPreference | null>(null);
  const [status, setStatus] = useState("");

  async function toggle(preference: NotificationPreference, enabled: boolean) {
    if (saving) return;
    setSaving(preference);
    setValues((current) => ({ ...current, [preference]: enabled }));
    try {
      const settings = await updateNotificationPreference(api, preference, enabled);
      setValues(settings.notification_preferences);
      setStatus(`${NOTIFICATION_LABELS[preference]}: ${enabled ? "on" : "off"}. Saved.`);
    } catch (failure) {
      setValues((current) => ({ ...current, [preference]: !enabled }));
      toast.show(isApiError(failure) ? failure.message : "That didn't save. Check your connection and try again.", { tone: "error" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col divide-y divide-line">
        {NOTIFICATION_PREFERENCES.map((preference) => (
          <li key={preference}>
            <Toggle
              label={NOTIFICATION_LABELS[preference]}
              labelPosition="start"
              checked={values[preference]}
              onChange={(event) => void toggle(preference, event.target.checked)}
              aria-busy={saving === preference || undefined}
              disabled={saving !== null && saving !== preference}
            />
          </li>
        ))}
      </ul>
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}
