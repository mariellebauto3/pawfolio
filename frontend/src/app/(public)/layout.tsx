import type { ReactNode } from "react";
import { GuestShell } from "@/components/layout/guest-shell";

// Sign in, forgot / reset password and sign-up (AU-02…AU-17).
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <GuestShell>{children}</GuestShell>;
}
