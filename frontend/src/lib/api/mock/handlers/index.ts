import { accountRoutes } from "@/lib/api/mock/handlers/accounts";
import { accountStatusRoutes } from "@/lib/api/mock/handlers/account-status";
import { activityLogRoutes } from "@/lib/api/mock/handlers/activity-logs";
import { adminAdoptionRoutes } from "@/lib/api/mock/handlers/admin-adoption";
import { adminVerificationRoutes } from "@/lib/api/mock/handlers/admin-verification";
import { analyticsRoutes } from "@/lib/api/mock/handlers/analytics";
import { adoptionRoutes } from "@/lib/api/mock/handlers/adoption";
import { adoptionRequestRoutes } from "@/lib/api/mock/handlers/adoption-requests";
import { announcementRoutes } from "@/lib/api/mock/handlers/announcements";
import { authRoutes } from "@/lib/api/mock/handlers/auth";
import { bookmarkRoutes } from "@/lib/api/mock/handlers/bookmarks";
import { communityFeedRoutes } from "@/lib/api/mock/handlers/community-feed";
import { discoveryRoutes } from "@/lib/api/mock/handlers/discovery";
import { inviteRoutes } from "@/lib/api/mock/handlers/invites";
import { matchingRoutes } from "@/lib/api/mock/handlers/matching";
import { meetAndGreetRoutes } from "@/lib/api/mock/handlers/meet-and-greet";
import { notificationRoutes } from "@/lib/api/mock/handlers/notifications";
import { reportRoutes } from "@/lib/api/mock/handlers/reports";
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
  ...meetAndGreetRoutes,
  ...adoptionRoutes,
  ...adminAdoptionRoutes,
  ...bookmarkRoutes,
  ...inviteRoutes,
  ...notificationRoutes,
  ...announcementRoutes,
  ...activityLogRoutes,
  ...communityFeedRoutes,
  ...reportRoutes,
  ...accountRoutes,
  ...analyticsRoutes,
];
