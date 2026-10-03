import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/navigation/brand-mark";

// Token reference for the team (FE-01). Uses token utilities only — no raw values — and is hidden in production.

export const metadata: Metadata = { title: "Design tokens" };

const SPECTRUM = [
  "bg-blue-900", "bg-blue-700", "bg-blue-600", "bg-blue-400", "bg-blue-200",
  "bg-gray-300", "bg-gray-200", "bg-gray-100",
  "bg-yellow-200", "bg-yellow-300", "bg-yellow-400", "bg-yellow-500",
];

const ROLES = [
  { name: "canvas", swatch: "bg-canvas", use: "Page background behind cards" },
  { name: "surface", swatch: "bg-surface", use: "Cards, bars, dialogs" },
  { name: "surface-sunken", swatch: "bg-surface-sunken", use: "Inputs, comments, photo placeholders" },
  { name: "ink", swatch: "bg-ink", use: "Body text, 17:1 on surface" },
  { name: "ink-muted", swatch: "bg-ink-muted", use: "Secondary text, AA on every surface" },
  { name: "line", swatch: "bg-line", use: "Dividers and card edges" },
  { name: "line-strong", swatch: "bg-line-strong", use: "Form-control borders, 3:1" },
  { name: "primary", swatch: "bg-primary", use: "One filled action per area, links" },
  { name: "primary-soft", swatch: "bg-primary-soft", use: "Selected chip, active nav, info" },
  { name: "accent", swatch: "bg-accent", use: "Celebration and highlights, with dark text" },
  { name: "accent-soft", swatch: "bg-accent-soft", use: "Warnings and new-item highlight" },
  { name: "danger", swatch: "bg-danger", use: "Errors and destructive actions only" },
];

const RAMPS = [
  { name: "blue", steps: ["bg-blue-50", "bg-blue-100", "bg-blue-200", "bg-blue-300", "bg-blue-400", "bg-blue-500", "bg-blue-600", "bg-blue-700", "bg-blue-800", "bg-blue-900", "bg-blue-950"] },
  { name: "yellow", steps: ["bg-yellow-50", "bg-yellow-100", "bg-yellow-200", "bg-yellow-300", "bg-yellow-400", "bg-yellow-500", "bg-yellow-600", "bg-yellow-700", "bg-yellow-800", "bg-yellow-900"] },
  { name: "gray", steps: ["bg-gray-25", "bg-gray-50", "bg-gray-100", "bg-gray-200", "bg-gray-300", "bg-gray-400", "bg-gray-500", "bg-gray-600", "bg-gray-700", "bg-gray-800", "bg-gray-900"] },
];

const TYPE = [
  { token: "text-5xl", font: "font-display font-bold", sample: "Every pet deserves a job offer." },
  { token: "text-4xl", font: "font-display font-bold", sample: "The job is being loved." },
  { token: "text-3xl", font: "font-display font-bold", sample: "Pets for You" },
  { token: "text-2xl", font: "font-display font-bold", sample: "Your request to Ana" },
  { token: "text-xl", font: "font-display font-semibold", sample: "Meet & Greet confirmed" },
  { token: "text-lg", font: "font-sans", sample: "Mochi is a playful Aspin who loves long walks and belly rubs." },
  { token: "text-base", font: "font-sans", sample: "Hi, I'm Mochi! I was found near a jeepney terminal and now I'm fostered by Happy Paws." },
  { token: "text-sm", font: "font-sans", sample: "Only your city is shown publicly." },
  { token: "text-xs", font: "font-sans", sample: "Sent 3 days ago. Expires in 11 days." },
];

const BADGES = [
  { tone: "badge-progress", rule: "Dashed outline: still in progress", labels: ["Sent", "Approved", "In Process", "On Hold", "Pending Verification"] },
  { tone: "badge-celebrate", rule: "Solid yellow: a happy ending", labels: ["Hired", "Adopted", "Furparent"] },
  { tone: "badge-attention", rule: "Solid blue: someone needs to act", labels: ["Decision needed", "Overdue 4 days"] },
  { tone: "badge-closed", rule: "Solid gray: closed or blocked", labels: ["Suspended", "Denied", "Declined"] },
];

const RADII = [
  { token: "rounded-badge", use: "Badges" },
  { token: "rounded-control", use: "Inputs" },
  { token: "rounded-card", use: "Cards, photos" },
  { token: "rounded-dialog", use: "Dialogs, drawers" },
  { token: "rounded-pill", use: "Buttons, chips" },
];

const SHADOWS = [
  { token: "shadow-raised", use: "Sticky bars" },
  { token: "shadow-menu", use: "Dropdowns" },
  { token: "shadow-dialog", use: "Dialogs" },
  { token: "shadow-toast", use: "Toasts" },
];

const SPACING = [
  { token: "1", width: "w-1" },
  { token: "2", width: "w-2" },
  { token: "3", width: "w-3" },
  { token: "4", width: "w-4" },
  { token: "6", width: "w-6" },
  { token: "8", width: "w-8" },
  { token: "12", width: "w-12" },
  { token: "16", width: "w-16" },
];

export default function DesignTokensPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-gutter">
          <BrandMark className="h-12" />
          <span className="font-display text-xl font-bold">Pawfolio</span>
          <span className="ml-auto text-sm text-ink-muted">Design tokens</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-content px-gutter pb-24">
        <section className="grid gap-8 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end md:py-16">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl md:text-5xl">Blue, yellow and gray.</h1>
            <p className="max-w-[60ch] text-lg text-ink-muted">
              Dogs see the world through two colour channels, blue and yellow, with gray in between. Pawfolio uses the
              same three, so meaning never depends on telling red from green.
            </p>
          </div>
          <figure className="flex flex-col gap-2">
            <div className="flex h-24 overflow-hidden rounded-card md:h-32" aria-hidden="true">
              {SPECTRUM.map((c) => (
                <span key={c} className={`${c} flex-1`} />
              ))}
            </div>
            <figcaption className="text-sm text-ink-muted">
              The whole palette, from blue through gray to yellow.
            </figcaption>
          </figure>
        </section>

        <section aria-labelledby="roles" className="flex flex-col gap-6 border-t border-line py-12">
          <div className="flex flex-col gap-2">
            <h2 id="roles" className="text-2xl">Colour roles</h2>
            <p className="max-w-[65ch] text-ink-muted">
              Components use these names (<code className="text-sm">bg-surface</code>,{" "}
              <code className="text-sm">text-ink-muted</code>). Changing a theme changes the values in{" "}
              <code className="text-sm">src/styles/tokens.css</code>, never the names.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r) => (
              <li key={r.name} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
                <span className={`${r.swatch} size-12 shrink-0 rounded-control border border-line`} />
                <span className="flex min-w-0 flex-col">
                  <code className="text-sm font-bold">{r.name}</code>
                  <span className="text-sm text-ink-muted">{r.use}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-4">
            <h3 className="text-xl">Brand ramps</h3>
            {RAMPS.map((ramp) => (
              <div key={ramp.name} className="flex flex-col gap-1">
                <span className="text-sm font-bold capitalize">{ramp.name}</span>
                <div className="flex overflow-hidden rounded-control border border-line">
                  {ramp.steps.map((s) => (
                    <span key={s} title={s.replace("bg-", "")} className={`${s} h-10 flex-1`} />
                  ))}
                </div>
              </div>
            ))}
            <p className="text-sm text-ink-muted">
              Ramps are for illustrations and charts. Interface code uses the roles above.
            </p>
          </div>
        </section>

        <section aria-labelledby="type" className="flex flex-col gap-6 border-t border-line py-12">
          <div className="flex flex-col gap-2">
            <h2 id="type" className="text-2xl">Type</h2>
            <p className="max-w-[65ch] text-ink-muted">
              Zilla Slab for headings, Atkinson Hyperlegible Next for reading. Body text is 16 px; nothing is smaller than
              13 px.
            </p>
          </div>
          <dl className="flex flex-col">
            {TYPE.map((t) => (
              <div
                key={t.token}
                className="grid gap-1 border-b border-line py-4 last:border-b-0 md:grid-cols-[8rem_minmax(0,1fr)] md:items-baseline md:gap-6"
              >
                <dt>
                  <code className="text-sm text-ink-muted">{t.token}</code>
                </dt>
                <dd className={`${t.token} ${t.font} max-w-[40ch] md:max-w-none`}>{t.sample}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="badges" className="flex flex-col gap-6 border-t border-line py-12">
          <div className="flex flex-col gap-2">
            <h2 id="badges" className="text-2xl">Status badges</h2>
            <p className="max-w-[65ch] text-ink-muted">
              The outline tells you whether a status is still moving. Every badge carries its status name, so colour is
              never the only signal.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {BADGES.map((b) => (
              <div key={b.tone} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
                <div className="flex flex-col">
                  <code className="text-sm font-bold">{b.tone}</code>
                  <span className="text-sm text-ink-muted">{b.rule}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.labels.map((label) => (
                    <span key={label} className={`${b.tone} px-2 py-0.5 text-xs font-bold`}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="shape" className="flex flex-col gap-8 border-t border-line py-12">
          <h2 id="shape" className="text-2xl">Radius, shadow and spacing</h2>
          <div className="flex flex-col gap-3">
            <h3 className="text-xl">Radius grows with the size of the thing</h3>
            <ul className="flex flex-wrap gap-4">
              {RADII.map((r) => (
                <li key={r.token} className="flex w-32 flex-col gap-2">
                  <span className={`${r.token} h-16 border-2 border-primary bg-primary-soft`} />
                  <code className="text-sm font-bold">{r.token}</code>
                  <span className="text-sm text-ink-muted">{r.use}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-xl">Shadows only on things that float</h3>
            <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {SHADOWS.map((s) => (
                <li key={s.token} className="flex flex-col gap-2">
                  <span className={`${s.token} h-20 rounded-card bg-surface`} />
                  <code className="text-sm font-bold">{s.token}</code>
                  <span className="text-sm text-ink-muted">{s.use}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-xl">Spacing on a 4 px grid</h3>
            <ul className="flex flex-col gap-2">
              {SPACING.map((s) => (
                <li key={s.token} className="flex items-center gap-3">
                  <code className="w-10 text-sm text-ink-muted">{s.token}</code>
                  <span className={`${s.width} h-4 rounded-badge bg-accent`} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="context" className="flex flex-col gap-6 border-t border-line py-12">
          <div className="flex flex-col gap-2">
            <h2 id="context" className="text-2xl">Together</h2>
            <p className="max-w-[65ch] text-ink-muted">
              A match card and a few controls built from tokens alone. Press Tab to see the focus ring.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-[20rem_minmax(0,1fr)] md:items-start">
            <article className="overflow-hidden rounded-card border border-line bg-surface">
              <div className="flex aspect-4/3 items-end bg-surface-sunken p-3">
                <span className="text-sm text-ink-muted">Photo of Mochi</span>
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <h3 className="text-xl">Mochi</h3>
                    <span className="text-sm text-ink-muted">Aspin, 2 yrs, medium</span>
                    <span className="text-sm text-ink-muted">Quezon City</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-display text-3xl font-bold">92%</span>
                    <span className="text-xs text-ink-muted">match</span>
                  </div>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-pill bg-surface-sunken"
                  role="meter"
                  aria-label="Match score"
                  aria-valuenow={92}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span className="block h-full w-[92%] rounded-pill bg-accent" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="badge-progress px-2 py-0.5 text-xs font-bold">In Process</span>
                  <span className="rounded-pill border border-line px-3 py-0.5 text-sm">Playful</span>
                  <span className="rounded-pill border border-line px-3 py-0.5 text-sm">Loyal</span>
                </div>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                  <li>Loves long walks, and so do you</li>
                  <li>Good with kids</li>
                </ul>
                <a href="#context" className="self-start text-sm font-bold text-primary underline">
                  Why this match?
                </a>
              </div>
            </article>

            <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="min-h-11 rounded-pill bg-primary px-5 font-bold text-primary-ink transition-colors duration-200 hover:bg-primary-hover"
                >
                  Send request
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-pill border-[1.5px] border-primary bg-surface px-5 font-bold text-primary transition-colors duration-200 hover:bg-primary-soft"
                >
                  Save to Bookmarks
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-pill px-4 font-bold text-ink-muted transition-colors duration-200 hover:bg-surface-sunken hover:text-ink"
                >
                  Not now
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="cover-letter" className="text-sm font-bold">
                  Cover letter
                </label>
                <textarea
                  id="cover-letter"
                  rows={3}
                  aria-describedby="cover-letter-hint"
                  className="rounded-control border border-line-strong bg-surface px-3 py-2 placeholder:text-ink-muted"
                  placeholder="Tell Ana why you'd be a good fit."
                />
                <span id="cover-letter-hint" className="text-sm text-ink-muted">
                  50 to 600 characters.
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <p role="status" className="rounded-card border-l-4 border-accent bg-accent-soft px-4 py-3 text-sm text-accent-soft-ink">
                  You have 2 open requests. A pet can have up to 3 at a time.
                </p>
                <p className="rounded-card border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger-soft-ink">
                  That email and password don&apos;t match. After 5 failed tries, sign-in pauses for 15 minutes.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-card bg-surface-inverse px-4 py-3 text-sm text-ink-inverse shadow-toast">
                Saved to Bookmarks.
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
