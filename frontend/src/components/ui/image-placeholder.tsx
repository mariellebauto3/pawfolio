import Image from "next/image";

type Props = {
  alt: string;
  cover?: boolean;
  sizes?: string;
  className?: string;
};

/** Bundled illustrations remain visible when a remote upload or the image optimizer is unavailable. */
export function ImagePlaceholder({ alt, cover = false, sizes = "100vw", className = "object-cover" }: Props) {
  return (
    <Image
      src={cover ? "/images/defaults/home-cover.png" : "/images/defaults/profile-avatar.png"}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      unoptimized
    />
  );
}
