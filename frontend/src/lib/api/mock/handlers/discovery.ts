import { RECENTLY_HIRED } from "@/lib/api/mock/fixtures/recently-hired";
import { type MockRoute, ok, route } from "@/lib/api/mock/router";

export const discoveryRoutes: MockRoute[] = [
  // Landing page strip (AU-01, docs/api/discovery.md): newest first, at most 8, public.
  route("GET", "/public/recently-hired", () => ok(RECENTLY_HIRED.slice(0, 8)), "public"),
];
