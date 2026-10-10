import Form from "next/form";
import Link from "next/link";
import { CONTROL_CLASSES } from "@/components/forms/control-styles";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { PET_STATUS_NAMES } from "@/constants/pets";
import { ROUTES, adminResolvePath } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { RESOLVE_SEARCH_MAX, RESOLVE_SEARCH_PARAM } from "../schemas/resolutions";
import type { PetMatch } from "../types/resolutions";

type Props = {
  /** What was searched for, shown in the box. */
  search: string | undefined;
  /** The pets that match; null before anything was searched, or when the search couldn't be run. */
  matches: { pets: PetMatch[]; total: number } | null;
  /** The search couldn't be run. */
  failed?: boolean;
};

const TEXT_LINK = "font-bold text-primary underline hover:text-primary-hover";
const SEARCH_ID = "resolve-pet-search";

// The first step of Resolve adoption issue when it is opened from the sidebar (AL-07): which pet is this about?
// A plain search form (?q=…), answered by the page on the server, so it works before the page's JavaScript has
// loaded. Choosing a pet puts its id in the address (?pet=…); nothing else about it travels in the URL.
export function PetFinder({ search, matches, failed = false }: Props) {
  return (
    <Card title="Which pet is this about?" description="Search by the pet’s name, or by its account’s email.">
      <Form action={ROUTES.adminResolve} role="search" className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor={SEARCH_ID} className="sr-only">
            Search pets by name or email
          </label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" />
          <input
            key={search ?? ""}
            id={SEARCH_ID}
            name={RESOLVE_SEARCH_PARAM}
            type="search"
            defaultValue={search}
            placeholder="e.g. Luna"
            enterKeyHint="search"
            autoComplete="off"
            required
            maxLength={RESOLVE_SEARCH_MAX}
            className={cn(CONTROL_CLASSES, "pl-10")}
          />
        </div>
        <button type="submit" className={buttonClasses({ variant: "primary" })}>
          Find pet
        </button>
      </Form>

      {failed && (
        <p role="alert" className="text-sm text-danger">
          We couldn’t search the pets. Please try again.
        </p>
      )}

      {matches &&
        (matches.pets.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p role="status" className="text-sm text-ink-muted">
              {matches.total > matches.pets.length ? `The first ${matches.pets.length} of ${matches.total} pets matching “${search}”. Type more of the name to narrow it down.` : `${matches.total} ${matches.total === 1 ? "pet matches" : "pets match"} “${search}”`}
            </p>
            <ul className="flex flex-col divide-y divide-line">
              {matches.pets.map((pet) => (
                <li key={pet.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {/* The name is written beside it, so the photo isn't read out as well. */}
                  <Avatar name={pet.name} src={pet.photo_url ?? undefined} alt="" size="md" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-bold wrap-break-word">{pet.name}</span>
                    <span className="text-sm wrap-break-word text-ink-muted">{[pet.city, pet.caretaker_name && `Caretaker: ${pet.caretaker_name}`].filter(Boolean).join(", ") || "Pet"}</span>
                  </div>
                  {pet.status && <StatusBadge status={PET_STATUS_NAMES[pet.status]} className="hidden sm:inline-flex" />}
                  <Link href={adminResolvePath(pet.id)} className={buttonClasses({ size: "sm", className: "shrink-0" })}>
                    Choose<span className="sr-only"> {pet.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p role="status" className="text-sm text-ink-muted">
            No pet matches “{search}”. Check the spelling, or search by the email of the pet’s account.
          </p>
        ))}

      <p className="text-sm text-ink-muted">
        Most issues start somewhere else: open one from an{" "}
        <Link href={`${ROUTES.adminRequests}?tab=overdue`} className={TEXT_LINK}>
          overdue request
        </Link>{" "}
        or from the{" "}
        <Link href={`${ROUTES.adminAccounts}?tab=alumni`} className={TEXT_LINK}>
          Alumni tab
        </Link>
        , and the pet and its request are filled in for you.
      </p>
    </Card>
  );
}
