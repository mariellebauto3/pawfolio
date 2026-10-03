import type { IsoDateTime } from "@/types/api";

/** One pet in the landing page's Recently Hired strip: `GET /api/v1/public/recently-hired` (docs/api/discovery.md). */
export type RecentlyHiredPet = {
  name: string;
  photo_url: string | null;
  hired_at: IsoDateTime;
};
