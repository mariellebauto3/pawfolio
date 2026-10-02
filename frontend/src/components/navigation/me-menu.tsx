"use client";

import { DropdownMenu, type MenuAction, type MenuItem } from "@/components/overlays/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { useSignOut } from "@/hooks/use-sign-out";
import type { Account } from "@/types/account";
import { meMenuFor } from "./nav-config";

const ROLE_LABELS = { pet: "Pet account", human: "Human account", admin: "Admin account" } as const;

type Props = {
  account: Account | null;
  /** The top bar's tab styling, including its active state on the pages the menu links to. */
  triggerClassName: string;
};

// The Me menu (GN-01): profile card, profile and account links by role, Log out.
export function MeMenu({ account, triggerClassName }: Props) {
  const { signOut } = useSignOut();
  const { profileLink, sections } = meMenuFor(account?.role ?? null);
  const name = account?.display_name ?? "Me";

  const signOutItem: MenuAction = { label: "Log out", onSelect: () => void signOut() };
  const items: MenuItem[] = profileLink ? [{ label: profileLink.label, href: profileLink.href }] : [];
  sections.forEach((section, i) => {
    const actions: MenuAction[] = section.links.map(({ label, href }) => ({ label, href }));
    // Log out ends the last group ("Account" for pets and humans), as in the LoFi.
    if (i === sections.length - 1) actions.push(signOutItem);
    if (items.length > 0) items.push({ type: "separator" });
    items.push({ type: "group", label: section.label, items: actions });
  });
  if (sections.length === 0) items.push(signOutItem);

  return (
    <DropdownMenu
      label="Me"
      align="end"
      items={items}
      triggerClassName={triggerClassName}
      header={
        account && (
          <div className="flex items-center gap-3">
            <Avatar name={name} src={account.avatar_url ?? undefined} alt="" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-bold">{name}</span>
              <span className="text-sm text-ink-muted">{ROLE_LABELS[account.role]}</span>
            </div>
          </div>
        )
      }
    >
      <Avatar name={name} src={account?.avatar_url ?? undefined} alt="" size="xs" />
      <span className="flex items-center gap-0.5">
        Me
        {/* Dropped on phones for room; the button still announces its menu (aria-haspopup). */}
        <Icon name="chevron-down" className="hidden size-3.5 sm:block" />
      </span>
    </DropdownMenu>
  );
}
