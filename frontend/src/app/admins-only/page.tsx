import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { homePathFor } from "@/lib/auth/redirects";
import { renderAccount } from "@/lib/auth/render-account";

// Preserve old links without disclosing restricted modules.
export default async function AdminsOnlyPage() {
  const lookup = await renderAccount();
  if (!lookup.ok) throw lookup.error;
  redirect(lookup.account ? homePathFor(lookup.account) : ROUTES.signIn);
}
