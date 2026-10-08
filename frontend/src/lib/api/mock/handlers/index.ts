import { accountStatusRoutes } from "@/lib/api/mock/handlers/account-status";
import { adminVerificationRoutes } from "@/lib/api/mock/handlers/admin-verification";
import { adoptionRequestRoutes } from "@/lib/api/mock/handlers/adoption-requests";
import { authRoutes } from "@/lib/api/mock/handlers/auth";
import { bookmarkRoutes } from "@/lib/api/mock/handlers/bookmarks";
import { discoveryRoutes } from "@/lib/api/mock/handlers/discovery";
import { matchingRoutes } from "@/lib/api/mock/handlers/matching";
import { signUpRoutes } from "@/lib/api/mock/handlers/sign-up";
import type { MockRoute } from "@/lib/api/mock/router";

// Add a module's mock routes here (one file per module) so its screens can be built before the endpoint exists.
// Match the planned path, response shape and errors in docs/api/ so switching to the real API changes nothing.
export const MOCK_ROUTES: readonly MockRoute[] = [
  ...authRoutes,
  ...signUpRoutes,
  ...accountStatusRoutes,
  ...adminVerificationRoutes,
  ...discoveryRoutes,
  ...matchingRoutes,
  ...adoptionRequestRoutes,
  ...bookmarkRoutes,
];
