"use client";

import Link from "next/link";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type MenuAction = {
  type?: "item";
  label: string;
  icon?: IconName;
  /** A second line, e.g. who can see the result. */
  description?: string;
  /** Runs after the menu closes and focus is back on the trigger, so a dialog it opens returns focus there. */
  onSelect?: () => void;
  /** Makes the item a link instead. */
  href?: string;
  /** Red text for items that remove something. The action itself still asks for confirmation. */
  destructive?: boolean;
  disabled?: boolean;
};

export type MenuItem =
  | MenuAction
  | { type: "separator" }
  /** Items under a small heading, e.g. "Resume" and "Account" in the Me menu (GN-01). */
  | { type: "group"; label: string; items: MenuAction[] };

type Props = {
  /** Names the trigger and the menu: "Post options", "Me". Read by screen readers; shown as the tooltip on icon triggers. */
  label: string;
  items: MenuItem[];
  /** Icon-only trigger (e.g. `more` for a ••• menu). Leave out and pass children for a text trigger. */
  icon?: IconName;
  /** Visible trigger content, e.g. an avatar and "Me". A chevron is added unless `triggerClassName` is set. */
  children?: ReactNode;
  /** Non-interactive content above the items, such as the profile card in the Me menu (GN-01). */
  header?: ReactNode;
  /** Which edge of the trigger the menu lines up with. Use `end` for triggers near the right of the screen. */
  align?: "start" | "end";
  /**
   * Replaces the trigger's styling (not merged), for a menu that sits in a navigation bar and must look like its
   * tabs. The trigger then shows only `children`, without the added chevron.
   */
  triggerClassName?: string;
  className?: string;
};

// Menu button (WAI-ARIA APG pattern): Me menu (GN-01), post options (FD-06). Enter, Space or ↓ opens on the first item,
// ↑ on the last; ↑ ↓ Home End move; a letter jumps to the next item starting with it; Escape closes and returns focus;
// Tab closes and moves on. Clicking outside closes.
//
// One item at most is highlighted, and it is always the one that Enter would choose: the highlight is the item's
// focus, and the pointer moves that focus as it moves. So a menu opened with the mouse shows nothing highlighted
// until an item is pointed at, an item stays highlighted while it is pressed, and leaving the items clears it.
export function DropdownMenu({
  label,
  items,
  icon,
  children,
  header,
  align = "start",
  triggerClassName,
  className,
}: Props) {
  const baseId = useId();
  const buttonId = `${baseId}-button`;
  const menuId = `${baseId}-menu`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  // Where focus goes as the menu opens: an item for the keyboard, the list itself (no item) for a pointer.
  const focusOnOpen = useRef<"first" | "last" | "none">("first");

  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  useEffect(() => {
    if (!open) return;
    const list = menuItems();
    if (focusOnOpen.current === "none") menuRef.current?.focus();
    else (focusOnOpen.current === "last" ? list[list.length - 1] : list[0])?.focus();

    function handlePointerDown(event: globalThis.PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function openMenu(at: "first" | "last" | "none") {
    focusOnOpen.current = at;
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowUp" ? "last" : "first");
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const list = menuItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => list[(next + list.length) % list.length]?.focus();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(index + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        // From the list itself (nothing highlighted yet), ↑ starts at the last item.
        move(index === -1 ? list.length - 1 : index - 1);
        return;
      case "Home":
        event.preventDefault();
        move(0);
        return;
      case "End":
        event.preventDefault();
        move(list.length - 1);
        return;
      case "Escape":
        // Handled here so a dialog around the menu doesn't close as well.
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case "Tab":
        setOpen(false);
        return;
    }

    // Type-ahead: jump to the next item whose label starts with the typed letter.
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const key = event.key.toLowerCase();
      const order = [...list.slice(index + 1), ...list.slice(0, index + 1)];
      order.find((el) => el.textContent?.trim().toLowerCase().startsWith(key))?.focus();
    }
  }

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={children ? undefined : label}
        title={children ? undefined : label}
        // `detail` is 0 when Enter or Space pressed the button, and the click count for a mouse or a finger.
        onClick={(event) => (open ? close(false) : openMenu(event.detail === 0 ? "first" : "none"))}
        onKeyDown={handleButtonKeyDown}
        className={
          triggerClassName ??
          (children
            ? buttonClasses({ variant: "tertiary" })
            : "grid size-11 place-items-center rounded-pill text-ink-muted transition-colors duration-200 ease-out " +
              "hover:bg-surface-sunken hover:text-ink aria-expanded:bg-surface-sunken aria-expanded:text-ink")
        }
      >
        {children ?? <Icon name={icon ?? "more"} />}
        {children && !triggerClassName && (
          <Icon
            name="chevron-down"
            className={cn("size-4 shrink-0 transition-transform duration-200", open && "rotate-180")}
          />
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full z-(--pf-z-dropdown) mt-2 w-max max-w-[calc(100vw-2rem)] min-w-56",
            "animate-menu-in rounded-card border border-line bg-surface p-1.5 shadow-menu",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {header && <div className="mb-1.5 border-b border-line px-2.5 pt-1.5 pb-3">{header}</div>}
          {/* Focusable from script only: it holds focus while no item is highlighted, so the arrow keys, a typed
              letter and Escape still work. It is never a Tab stop and shows no ring of its own. */}
          <ul
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={buttonId}
            tabIndex={-1}
            onKeyDown={handleMenuKeyDown}
            // Off the items (the gap between two, a group's heading, out of the menu): nothing stays highlighted.
            onPointerLeave={() => menuRef.current?.focus()}
            className="outline-none"
          >
            {items.map((item, i) => {
              if (item.type === "separator") {
                return <li key={`separator-${i}`} role="separator" className="mx-2 my-1.5 border-t border-line" />;
              }
              if (item.type === "group") {
                return (
                  <li key={`group-${item.label}`} role="none">
                    {/* Screen readers hear the label as the group's name instead. It's aria-label, not
                        aria-labelledby, so the name keeps its case: browsers apply `uppercase` to labelledby names. */}
                    <span
                      aria-hidden="true"
                      className="block px-2.5 pt-2 pb-1 text-xs font-bold tracking-wide text-ink-muted uppercase"
                    >
                      {item.label}
                    </span>
                    <ul role="group" aria-label={item.label}>
                      {item.items.map((action) => (
                        <li key={action.label} role="none">
                          <MenuItemControl item={action} onDone={close} />
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              }
              return (
                <li key={item.label} role="none">
                  <MenuItemControl item={item} onDone={close} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

type ItemProps = {
  item: MenuAction;
  onDone: (returnFocus: boolean) => void;
};

function MenuItemControl({ item, onDone }: ItemProps) {
  // The highlight is `focus` alone, never `hover`: the two would otherwise light up two items at once (one under
  // the pointer, one the arrow keys reached).
  const classes = cn(
    "flex min-h-11 w-full items-center gap-3 rounded-control px-2.5 py-2 text-left no-underline",
    "transition-colors duration-150 focus:bg-surface-sunken",
    item.destructive ? "text-danger" : "text-ink",
    item.disabled && "cursor-not-allowed opacity-50",
  );

  /** Pointing at an item highlights it: focus follows the pointer. A disabled item takes the highlight off instead. */
  function follow(event: PointerEvent<HTMLElement>) {
    const target = event.currentTarget;
    if (item.disabled) target.closest<HTMLElement>('[role="menu"]')?.focus();
    else if (document.activeElement !== target) target.focus();
  }

  const content = (
    <>
      {item.icon && (
        <Icon name={item.icon} className={cn("size-5 shrink-0", !item.destructive && "text-ink-muted")} />
      )}
      <span className="flex min-w-0 flex-col">
        <span>{item.label}</span>
        {item.description && <span className="text-sm text-ink-muted">{item.description}</span>}
      </span>
    </>
  );

  if (item.href && !item.disabled) {
    return (
      <Link href={item.href} role="menuitem" tabIndex={-1} className={classes} onPointerMove={follow} onClick={() => onDone(false)}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={item.disabled || undefined}
      className={classes}
      onPointerMove={follow}
      onClick={() => {
        if (item.disabled) return;
        onDone(true);
        item.onSelect?.();
      }}
    >
      {content}
    </button>
  );
}
