import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/forms/reset-password-form";

// The reset link carries its token after "#", which only the browser sees; don't let the page leak its URL either.
export const metadata: Metadata = { title: "Set a new password", referrer: "no-referrer" };

// AU-06 Set a new password.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
