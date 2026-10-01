import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export type BannerTone = "neutral" | "info" | "celebrate" | "attention";

type Props = {
  /** Same meanings as the badge tones: celebrate = Hired / Adopted, attention = someone has to act. */
  tone?: BannerTone;
  /** An icon name, or any element such as an Avatar ("Hired by Ana Santos"). */
  icon?: IconName | ReactNode;
  title: ReactNode;
  children?: ReactNode;
  /** One or two buttons. On the attention tone use secondary buttons; a primary one would vanish on the blue. */
  actions?: ReactNode;
  /** Shows a close button. Only for banners that can be dismissed for good, such as announcements. */
  onDismiss?: () => void;
  className?: string;
};

const TONES: Record<BannerTone, string> = {
  neutral: "border border-line bg-surface text-ink",
  info: "bg-primary-soft text-primary-soft-ink",
  celebrate: "bg-accent text-accent-ink",
  attention: "bg-primary text-primary-ink",
};

// A message about the whole page or profile, at the top of the content: "Hired by Ana Santos", "Your résumé is a
// draft", an admin announcement, "The meeting time has passed". Messages inside a card or form use Alert.
export function Banner({ tone = "neutral", icon, title, children, actions, onDismiss, className }: Props) {
  const iconNode = typeof icon === "string" ? <Icon name={icon as IconName} className="size-6 shrink-0" /> : icon;

  return (
    <div
      className={cn("flex items-start gap-3 rounded-card p-4 md:items-center md:gap-4 md:px-5", TONES[tone], className)}
    >
      {iconNode && <div className="shrink-0 pt-0.5 md:pt-0">{iconNode}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-display text-lg font-bold">{title}</p>
          {children && <div className={cn("text-sm", tone === "neutral" && "text-ink-muted")}>{children}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <IconButton
          icon="x"
          label="Dismiss"
          tone={tone === "neutral" ? "default" : "inverse"}
          onClick={onDismiss}
          className="-my-2 -mr-2"
        />
      )}
    </div>
  );
}
