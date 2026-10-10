import type { ApiClient } from "@/lib/api/core";
import { isRecord, isText, unexpected } from "@/lib/api/readers";
import type { ApiResource } from "@/types/api";
import { ACCOUNT_STATUSES, type AccountStatus } from "@/types/statuses";
import {
  CHANGE_REQUEST_STATUSES,
  type ChangeRequest,
  type ChangeRequestInput,
  type ChangeRequestStatus,
  type ContactDetails,
  type DeactivationInput,
  LOCKED_FIELDS,
  type LockedField,
  NOTIFICATION_PREFERENCES,
  type NotificationPreference,
  type NotificationPreferences,
  type PasswordInput,
  type Settings,
} from "../types/accounts";

// The owner's own account (docs/api/community-reports-and-admin.md, AC-01…AC-05). Settings are read from a Server
// Component with `getServerApi()`; every write runs in the browser, where the CSRF token is. Whose account it is
// comes from the session, and its role and status are never sent (SEC-AUTHZ-02, SEC-INPUT-04). Contact details come
// back to their owner only and stay in memory: never in browser storage or a URL (SEC-FE-04).

const SETTINGS = "/settings";
const SETTINGS_PROBLEM = "We couldn't load your settings. Please try again.";
const SAVED_PROBLEM = "We couldn't confirm that was saved. Reload the page to see your settings as they stand.";
const SENT_PROBLEM = "We couldn't tell whether your request was sent. Reload the page before sending it again.";

const isId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const isDate = (value: unknown): value is string => isText(value) && !Number.isNaN(new Date(value).getTime());
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => (list as readonly unknown[]).includes(value);
/** A detail as text, whatever the API holds it as (an age is a number). */
const asText = (value: unknown): string | undefined => (isText(value) ? value : typeof value === "number" ? String(value) : undefined);

/** A change request as the screen reads it, or null when it doesn't match the contract and isn't shown. */
export function toChangeRequest(row: unknown): ChangeRequest | null {
  if (!isRecord(row) || !isId(row.id) || !oneOf<LockedField>(LOCKED_FIELDS, row.field) || !oneOf<ChangeRequestStatus>(CHANGE_REQUEST_STATUSES, row.status) || !isDate(row.created_at)) {
    return null;
  }
  return {
    id: row.id,
    field: row.field,
    new_value: asText(row.new_value) ?? "",
    reason: isText(row.reason) ? row.reason : "",
    status: row.status,
    has_document: row.has_document === true,
    reviewed_at: isDate(row.reviewed_at) ? row.reviewed_at : null,
    created_at: row.created_at,
  };
}

function readSettings(response: ApiResource<unknown> | null | undefined, problem: string): Settings {
  const data = response?.data;
  const account = isRecord(data) ? data.account : null;
  // The screen picks its cards from the role, so an answer without one isn't trusted.
  if (!isRecord(data) || !isRecord(account) || !isId(account.id) || (account.role !== "pet" && account.role !== "human") || !oneOf<AccountStatus>(ACCOUNT_STATUSES, account.status)) {
    throw unexpected(problem);
  }
  const locked = isRecord(data.locked_details) ? data.locked_details : {};
  const contact = isRecord(data.contact_details) ? data.contact_details : {};
  const preferences = isRecord(data.notification_preferences) ? data.notification_preferences : {};

  return {
    account: { id: account.id, role: account.role, status: account.status, email: asText(account.email) ?? "", display_name: asText(account.display_name) ?? "" },
    locked_details: Object.fromEntries(LOCKED_FIELDS.flatMap((field) => (asText(locked[field]) === undefined ? [] : [[field, asText(locked[field])]]))),
    contact_details: {
      caretaker_name: asText(contact.caretaker_name),
      caretaker_contact_number: asText(contact.caretaker_contact_number),
      contact_number: asText(contact.contact_number),
      street_address: asText(contact.street_address),
    },
    // A preference the answer doesn't carry reads as on, the API's own default.
    notification_preferences: Object.fromEntries(NOTIFICATION_PREFERENCES.map((key) => [key, preferences[key] !== false])) as NotificationPreferences,
    change_requests: Array.isArray(data.change_requests) ? data.change_requests.flatMap((row) => toChangeRequest(row) ?? []) : [],
  };
}

/** The account's settings: verified details, contact details, notification preferences and its change requests. */
export async function getSettings(client: ApiClient): Promise<Settings> {
  return readSettings(await client.get<ApiResource<unknown>>(SETTINGS), SETTINGS_PROBLEM);
}

/**
 * Saves the contact details the role has: a pet's caretaker name and number, or a human's number and street
 * address. Throws ApiError: 422 `fieldErrors` by field name.
 */
export async function updateContactDetails(client: ApiClient, details: ContactDetails): Promise<Settings> {
  const body = Object.fromEntries(Object.entries(details).filter(([, value]) => typeof value === "string"));
  return readSettings(await client.patch<ApiResource<unknown>>(SETTINGS, body), SAVED_PROBLEM);
}

/** Turns one kind of notification on or off. It applies at once. */
export async function updateNotificationPreference(client: ApiClient, preference: NotificationPreference, enabled: boolean): Promise<Settings> {
  return readSettings(await client.patch<ApiResource<unknown>>(SETTINGS, { notification_preferences: { [preference]: enabled } }), SAVED_PROBLEM);
}

/**
 * Changes the password (AC-04). The API signs out every other device and keeps this one (SEC-AUTH-07). Throws
 * ApiError: 422 `fieldErrors` for `current_password` and `password`.
 */
export async function changePassword(client: ApiClient, input: PasswordInput): Promise<void> {
  await client.post(`${SETTINGS}/password`, input);
}

/**
 * Closes the owner's own account (AC-05), confirmed with the password. The API ends the session; nothing redirects
 * on the 401 a later call would get. Throws ApiError: 422 `fieldErrors.password` when it is wrong.
 */
export async function deactivateOwnAccount(client: ApiClient, input: DeactivationInput): Promise<void> {
  await client.post(`${SETTINGS}/deactivate`, { password: input.password, reason: input.reason }, { skipAuthRedirect: true });
}

/**
 * Asks an admin to change a locked detail (AC-03), with an optional supporting document (JPG, PNG or PDF, up to
 * 5 MB), which goes to the private disk (SEC-FILE-01…05). Throws ApiError: 422 `fieldErrors` for `field`,
 * `new_value`, `reason` and `document`; 409 `change_request_pending` when one for that detail is already waiting.
 */
export async function requestChange(client: ApiClient, input: ChangeRequestInput): Promise<ChangeRequest> {
  const fields = { field: input.field, new_value: input.new_value, reason: input.reason };
  let body: FormData | typeof fields = fields;
  if (input.document) {
    body = new FormData();
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    body.append("document", input.document);
  }
  const request = toChangeRequest((await client.post<ApiResource<unknown>>(`${SETTINGS}/change-requests`, body))?.data);
  if (!request) throw unexpected(SENT_PROBLEM);
  return request;
}
