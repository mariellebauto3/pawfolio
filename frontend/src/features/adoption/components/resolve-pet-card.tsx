import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PET_STATUS_NAMES } from "@/constants/pets";
import { ROUTES, adminAccountPath } from "@/constants/routes";
import { formatDate } from "@/lib/utils/format-date";
import { ResolveIssueForm } from "../forms/resolve-issue-form";
import { resolveStateKey } from "../schemas/resolutions";
import type { ResolveOptions } from "../types/resolutions";

type Props = {
  options: ResolveOptions;
  /** The request the page was opened on, when it came from one. */
  requestId: number | null;
};

const TEXT_LINK = "font-bold text-primary underline hover:text-primary-hover";

// The pet an issue is resolved for, where it stands now, and the form (AL-07). The status badge is read-only, as
// everywhere: the form below changes it through an action, never by picking one (FR27).
export function ResolvePetCard({ options, requestId }: Props) {
  const { pet, furparent } = options;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line pb-4">
        {/* The name is written beside it, so the photo isn't read out as well. */}
        <Avatar name={pet.name} src={pet.photo_url ?? undefined} alt="" size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-xl wrap-break-word">{pet.name}</h2>
          <p className="text-sm text-ink-muted">
            {furparent?.full_name
              ? `Adopted by ${furparent.full_name}${furparent.adopted_at ? ` on ${formatDate(furparent.adopted_at)}` : ""}`
              : [pet.city, "No Furparent link"].filter(Boolean).join(", ")}
          </p>
          <p className="flex flex-wrap gap-x-4 text-sm">
            {pet.user_id !== null && (
              <Link href={adminAccountPath(pet.user_id)} className={TEXT_LINK}>
                Open account
              </Link>
            )}
            <Link href={ROUTES.adminResolve} className={TEXT_LINK}>
              Choose another pet
            </Link>
          </p>
        </div>
        <StatusBadge status={PET_STATUS_NAMES[pet.status]} />
      </div>

      <ResolveIssueForm key={resolveStateKey(options)} options={options} requestId={requestId} />
    </Card>
  );
}
