import { GuestShell } from "@/components/layout/guest-shell";

// Placeholder until the landing page (AU-01) is built. Its sections need the ids in LANDING_SECTIONS
// (src/constants/routes.ts), which the guest top bar and footer link to.
export default function Home() {
  return (
    <GuestShell>
      <div className="mx-auto flex w-full max-w-content flex-1 flex-col justify-center gap-4 px-gutter py-16">
        <h1 className="max-w-[18ch] text-4xl md:text-5xl">Every pet deserves a job offer. The job is being loved.</h1>
        <p className="max-w-[60ch] text-lg text-ink-muted">
          Pets build a résumé, apply to homes that fit their lifestyle, and get Hired by their future Furparent.
        </p>
      </div>
    </GuestShell>
  );
}
