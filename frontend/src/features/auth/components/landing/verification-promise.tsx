import { Icon, type IconName } from "@/components/ui/icon";
import { HiredCardArt, Sparkle } from "./landing-illustrations";

// What every visitor can count on (proposal rules: FR1, FR18, NFR4, FR32). Keep in step with the FAQ answers.
const PROMISES: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "circle-check", title: "Checked by a person", body: "An admin approves every ID before an account can act." },
  { icon: "lock", title: "Address kept private", body: "Shared only after a Meet & Greet is confirmed." },
  { icon: "heart", title: "Matched with reasons", body: "Every match score shows why it fits." },
  { icon: "flag", title: "Adoption only", body: "Selling or trading animals gets reported and removed." },
];

// AU-01 verification promise, as a full-width brand band. Sign-up stays one click away in the top bar (Join now).
export function VerificationPromise() {
  return (
    <section aria-labelledby="verification-title" className="relative isolate overflow-hidden bg-surface-brand px-gutter py-16 text-ink-on-brand md:py-24">
      <div className="mx-auto grid max-w-content items-center gap-10 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 id="verification-title" className="max-w-[18ch] text-3xl md:text-5xl">
            Every account is checked by a real person.
          </h2>
          <p className="mt-4 max-w-[52ch] text-lg text-ink-on-brand-muted">
            Caretakers and adopters submit an ID before they can use Pawfolio, so every pet and every home you meet is
            who they say they are.
          </p>

          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {PROMISES.map(({ icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-pill bg-ink-on-brand text-primary">
                  <Icon name={icon} className="size-5" />
                </span>
                <span>
                  <span className="block font-bold">{title}</span>
                  <span className="block text-ink-on-brand-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" className="relative hidden w-72 lg:block">
          <HiredCardArt className="w-full" />
          <Sparkle className="absolute top-[30%] left-[4%] w-8" />
          <Sparkle className="absolute right-[6%] bottom-[12%] w-5" />
        </div>
      </div>
    </section>
  );
}
