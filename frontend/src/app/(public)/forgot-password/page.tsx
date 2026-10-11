import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/forms/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

// AU-04 Forgot password and AU-05 Reset link sent.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
