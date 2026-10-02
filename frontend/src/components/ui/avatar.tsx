import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { Icon } from "./icon";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { box: string; text: string; px: number }> = {
  // Icon-sized, for the Me tab in the top bar. Initials are trimmed to one letter to fit.
  xs: { box: "size-6", text: "text-xs", px: 24 },
  sm: { box: "size-8", text: "text-xs", px: 32 },
  md: { box: "size-10", text: "text-sm", px: 40 },
  lg: { box: "size-14", text: "text-lg", px: 56 },
  xl: { box: "size-24", text: "text-3xl", px: 96 },
};

type Props = {
  /** Account or pet name. Used for the initials and the default alt text. */
  name: string;
  /** Photo URL. Remote hosts must be allowed in next.config `images.remotePatterns`. */
  src?: string;
  /** Pass "" when the name is already written next to the avatar, so it isn't read twice. */
  alt?: string;
  size?: Size;
  className?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// Round avatar for pets and humans. Without a photo it shows initials on a soft blue disc.
export function Avatar({ name, src, alt, size = "md", className }: Props) {
  const s = SIZES[size];
  const label = alt ?? name;
  const letters = size === "xs" ? initials(name).slice(0, 1) : initials(name);

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-pill bg-primary-soft text-primary-soft-ink",
        s.box,
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={label} fill sizes={`${s.px}px`} className="object-cover" />
      ) : (
        <>
          {letters ? (
            <span aria-hidden="true" className={cn("font-display font-bold", s.text)}>
              {letters}
            </span>
          ) : (
            <Icon name="user" className="size-1/2" />
          )}
          {label && <span className="sr-only">{label}</span>}
        </>
      )}
    </span>
  );
}
