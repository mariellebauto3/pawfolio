import { accountStatusRoutes } from "@/lib/api/mock/handlers/account-status";
import { adoptionRequestRoutes } from "@/lib/api/mock/handlers/adoption-requests";
import { authRoutes } from "@/lib/api/mock/handlers/auth";
import { discoveryRoutes } from "@/lib/api/mock/handlers/discovery";
import { profileRoutes } from "@/lib/api/mock/handlers/profiles";
import { signUpRoutes } from "@/lib/api/mock/handlers/sign-up";
import type { MockRoute } from "@/lib/api/mock/router";

// Add a module's mock routes here (one file per module) so its screens can be built before the endpoint exists.
// Match the planned path, response shape and errors in docs/api/ so switching to the real API changes nothing.
export const MOCK_ROUTES: readonly MockRoute[] = [
  ...authRoutes,
  ...signUpRoutes,
  ...accountStatusRoutes,
  ...discoveryRoutes,
  ...profileRoutes,
  ...adoptionRequestRoutes,
];
