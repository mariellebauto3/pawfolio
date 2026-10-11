import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";

type Side = {
  /** Whose photo it is; the initials stand in when there is none. */
  name: string;
  /** What is written under the photo when it isn't the name: "You", on the reader's own side. */
  label?: string;
  photoUrl: string | null;
  /** What goes under the name: "Dog · Aspin", "Furparent · Quezon City". Left out when there is nothing to add. */
  caption?: string;
};

type Props = {
  pet: Side;
  home: Side;
  /**
   * `pending`: the adoption is still a question (AL-01), so the two are joined by a dashed line that points from
   * the pet to the home. `linked`: it happened (AL-02, AL-03, AL-06), so the line is solid and carries the Hired tag.
   */
  state: "pending" | "linked";
  /** `xl` for the two celebrations, `lg` where it sits above other content. */
  size?: "lg" | "xl";
  /** Draws the line and stamps the tag once, when the picture answers the Adopt action (AL-02, AL-03). */
  animate?: boolean;
};

// The connector sits at half the photo's height, whatever is written under the names.
const ROW = { lg: "h-14", xl: "h-24" };

function Person({ side, size }: { side: Side; size: "lg" | "xl" }) {
  return (
    // Wide enough for "Furparent · Quezon City" on one or two lines, and narrow enough for two on a phone.
    <span className="flex w-28 min-w-0 flex-col items-center gap-1 text-center">
      {/* Who it is, is written right under it, so the photo isn't read out as well. */}
      <Avatar name={side.name} src={side.photoUrl ?? undefined} alt="" size={size} />
      <span className="max-w-full font-bold wrap-break-word">{side.label ?? side.name}</span>
      {side.caption && <span className="max-w-full text-sm wrap-break-word text-ink-muted">{side.caption}</span>}
    </span>
  );
}

// The permanent link between a pet and its Furparent, drawn the way the status badges speak: dashed while it is
// still open, solid yellow once the pet is Hired. One picture for the question (AL-01), the two celebrations (AL-02,
// AL-03) and the record (AL-06). Both names are written out, and the state is said in words for screen readers.
export function AdoptionLink({ pet, home, state, size = "lg", animate = false }: Props) {
  const linked = state === "linked";

  return (
    <div className="flex items-start justify-center gap-1">
      <Person side={pet} size={size} />

      <span className={cn("flex shrink-0 items-center", ROW[size])}>
        {linked ? (
          <>
            <span aria-hidden="true" className={cn("h-1 w-4 origin-left rounded-l-pill bg-accent ring-1 ring-accent-edge md:w-6", animate && "animate-link-in")} />
            <StatusBadge status="Hired" className={cn("relative", animate && "animate-stamp-in")} />
            <span aria-hidden="true" className={cn("h-1 w-4 origin-right rounded-r-pill bg-accent ring-1 ring-accent-edge md:w-6", animate && "animate-link-in")} />
            <span className="sr-only">, linked to </span>
          </>
        ) : (
          <>
            <span aria-hidden="true" className="w-4 border-t-[1.5px] border-dashed border-line-strong md:w-6" />
            <Icon name="chevron-right" className="size-5 shrink-0 text-ink-muted" />
            <span aria-hidden="true" className="w-4 border-t-[1.5px] border-dashed border-line-strong md:w-6" />
            <span className="sr-only"> to </span>
          </>
        )}
      </span>

      <Person side={home} size={size} />
    </div>
  );
}
