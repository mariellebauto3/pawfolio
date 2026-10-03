import type { ApiClient } from "@/lib/api/core";
import type { ApiResource } from "@/types/api";
import type { RecentlyHiredPet } from "../types/recently-hired";

export const RECENTLY_HIRED_ENDPOINT = "/public/recently-hired";

/** The landing page's Recently Hired strip (AU-01). Public: no session needed. */
export async function fetchRecentlyHired(client: ApiClient): Promise<RecentlyHiredPet[]> {
  const response = await client.get<ApiResource<RecentlyHiredPet[]>>(RECENTLY_HIRED_ENDPOINT);
  return Array.isArray(response?.data) ? response.data : [];
}
