import { cn } from "@/lib/utils/cn";
import { ApiImage } from "./api-image";
import { ImagePlaceholder } from "./image-placeholder";

type Ratio = "pet" | "cover" | "square";

// Image placeholders keep their aspect ratios (ui-guidelines §2): pet photos 4:3, covers wide.
const RATIOS: Record<Ratio, string> = {
  pet: "aspect-4/3",
  cover: "aspect-3/1 md:aspect-5/1",
  square: "aspect-square",
};

type Props = {
  /** Describe the picture with the pet's name and context, e.g. "Mochi lying in the grass". */
  alt: string;
  src?: string;
  ratio?: Ratio;
  /** Rendered width hint for the image optimizer, e.g. "(min-width: 768px) 320px, 100vw". */
  sizes?: string;
  /** Load first when the photo is the largest thing above the fold. */
  preload?: boolean;
  /** Set false when the photo runs to the edge of a card that already clips its corners. */
  rounded?: boolean;
  className?: string;
};

// Photo frame with a fixed ratio, so the layout doesn't jump while the image loads. Without `src`, or when the
// picture can't be loaded, a bundled illustration keeps the frame visible. Remote hosts must be allowed in next.config
// `images.remotePatterns`.
export function Photo({ alt, src, ratio = "pet", sizes = "100vw", preload, rounded = true, className }: Props) {
  const placeholder = <ImagePlaceholder alt={`Illustration; photo unavailable: ${alt}`} cover={ratio === "cover"} sizes={sizes} />;

  return (
    <div className={cn("relative overflow-hidden bg-surface-sunken", rounded && "rounded-card", RATIOS[ratio], className)}>
      {src ? <ApiImage src={src} alt={alt} fill sizes={sizes} preload={preload} className="object-cover" fallback={placeholder} /> : placeholder}
    </div>
  );
}
