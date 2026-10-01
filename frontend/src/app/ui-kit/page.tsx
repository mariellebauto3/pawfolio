import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Checkbox } from "@/components/forms/checkbox";
import { ChoiceChips } from "@/components/forms/choice-chips";
import { Field } from "@/components/forms/field";
import { Fieldset } from "@/components/forms/fieldset";
import { FileUpload } from "@/components/forms/file-upload";
import { Input } from "@/components/forms/input";
import { RadioCards } from "@/components/forms/radio-cards";
import { Select } from "@/components/forms/select";
import { Stepper } from "@/components/forms/stepper";
import { Textarea } from "@/components/forms/textarea";
import { Toggle } from "@/components/forms/toggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Photo } from "@/components/ui/photo";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tag } from "@/components/ui/tag";
import type { StatusName } from "@/constants/status-badges";
import { LoadingButtonDemo } from "./_components/loading-button-demo";
import { LockedFieldDemo } from "./_components/locked-field-demo";
import { WizardDemo } from "./_components/wizard-demo";

// Shared component reference for the team (FE-02), mirroring the LoFi UI kit sheets. Hidden in production.
// All names and details are fake demo data (SEC-PRIV-06).

export const metadata: Metadata = { title: "UI kit" };

const STATUS_GROUPS: Array<{ name: string; statuses: StatusName[] }> = [
  { name: "Account", statuses: ["Pending Verification", "Active", "Denied", "Suspended", "Deactivated"] },
  { name: "Pet", statuses: ["Draft", "Looking for a Home", "In Process", "Hired"] },
  {
    name: "Request",
    statuses: [
      "Sent",
      "On Hold",
      "Approved",
      "Meet Scheduled",
      "Awaiting Decision",
      "Adopted",
      "Declined",
      "Not Adopted",
      "Withdrawn",
      "Expired",
    ],
  },
  { name: "Human", statuses: ["Open to Adopt", "Furparent"] },
];

const SECTION = "grid gap-6 border-t border-line py-12 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10";
const INTRO = "flex flex-col gap-2";
const NOTE = "max-w-[65ch] text-sm text-ink-muted";

export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-content items-center gap-3 px-gutter">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-control bg-accent font-display text-lg font-bold text-accent-ink"
          >
            P
          </span>
          <span className="font-display text-xl font-bold">Pawfolio</span>
          <nav aria-label="Developer pages" className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/design-tokens" className={buttonClasses({ variant: "tertiary", size: "sm" })}>
              Design tokens
            </Link>
            <span aria-current="page" className="px-3 font-bold">
              UI kit
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-content px-gutter pb-24">
        <section className="flex flex-col gap-4 py-12 md:py-16">
          <h1 className="text-4xl md:text-5xl">UI kit</h1>
          <p className="max-w-[60ch] text-lg text-ink-muted">
            The shared building blocks every screen is made from. Each one is reachable by keyboard, has a 44 px touch
            target on phones, and uses tokens only. Press Tab to walk through the page.
          </p>
        </section>

        {/* ---------- Buttons ---------- */}
        <section aria-labelledby="buttons" className={SECTION}>
          <div className={INTRO}>
            <h2 id="buttons" className="text-2xl">Buttons</h2>
            <p className={NOTE}>
              One primary per area. Destructive buttons only confirm a dialog, after the user has read what will happen.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Card titleAs="h3" title="Variants">
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Send request</Button>
                <Button variant="secondary">Save to Bookmarks</Button>
                <Button variant="tertiary">Not now</Button>
                <Button variant="destructive">Withdraw request</Button>
              </div>
            </Card>
            <Card titleAs="h3" title="Sizes and states">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="sm">
                  View résumé
                </Button>
                <Button size="sm">Bookmark</Button>
                <Button variant="primary" disabled>
                  Book this slot
                </Button>
                <LoadingButtonDemo />
                <Link href="/design-tokens" className={buttonClasses({ variant: "secondary" })}>
                  A link styled as a button
                </Link>
              </div>
              <p className={NOTE}>
                Small buttons are 36 px tall on desktop and 44 px on phones. Loading keeps focus on the button and
                ignores repeat clicks.
              </p>
            </Card>
          </div>
        </section>

        {/* ---------- Badges and tags ---------- */}
        <section aria-labelledby="badges" className={SECTION}>
          <div className={INTRO}>
            <h2 id="badges" className="text-2xl">Badges and tags</h2>
            <p className={NOTE}>
              Badges show a status with its exact name; the outline means it&apos;s still moving. Tags describe, and
              never change.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Card titleAs="h3" title="Status badges">
              <dl className="grid gap-x-6 gap-y-3 md:grid-cols-[6rem_minmax(0,1fr)]">
                {STATUS_GROUPS.map((group) => (
                  <div key={group.name} className="contents">
                    <dt className="text-sm font-bold">{group.name}</dt>
                    <dd className="flex flex-wrap gap-2">
                      {group.statuses.map((status) => (
                        <StatusBadge key={status} status={status} />
                      ))}
                    </dd>
                  </div>
                ))}
                <div className="contents">
                  <dt className="text-sm font-bold">Other labels</dt>
                  <dd className="flex flex-wrap gap-2">
                    <Badge tone="attention">Decision needed</Badge>
                    <Badge tone="attention">Overdue 4 days</Badge>
                  </dd>
                </div>
              </dl>
            </Card>
            <Card titleAs="h3" title="Tags">
              <div className="flex flex-wrap gap-2">
                <Tag>Playful</Tag>
                <Tag>Loyal</Tag>
                <Tag>Good with kids</Tag>
                <Tag icon={<Icon name="check" />}>Species accepted</Tag>
              </div>
            </Card>
          </div>
        </section>

        {/* ---------- Cards and pictures ---------- */}
        <section aria-labelledby="pictures" className={SECTION}>
          <div className={INTRO}>
            <h2 id="pictures" className="text-2xl">Cards, avatars and photos</h2>
            <p className={NOTE}>
              Cards sit on the canvas with a thin line, no shadow. Photos keep their ratio while loading: pet photos
              4:3, covers wide, avatars round.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start">
              <Card as="article" padding="none">
                <Photo alt="Photo of Mochi" rounded={false} sizes="(min-width: 768px) 288px, 100vw" />
                <div className="flex flex-col gap-3 px-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <h3 className="text-xl">Mochi</h3>
                      <span className="text-sm text-ink-muted">Aspin, 2 yrs, Quezon City</span>
                    </div>
                    <StatusBadge status="Looking for a Home" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Tag>Playful</Tag>
                    <Tag>Loyal</Tag>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" size="sm">
                      View résumé
                    </Button>
                    <Button size="sm">Bookmark</Button>
                  </div>
                </div>
              </Card>
              <Card
                titleAs="h3"
                title="Verified details"
                description="A card with a title, a description and an action."
                action={
                  <Button variant="tertiary" size="sm">
                    Edit
                  </Button>
                }
              >
                <div className="flex flex-wrap items-end gap-4">
                  <Avatar name="Ana Santos" size="xl" />
                  <Avatar name="Ana Santos" size="lg" />
                  <Avatar name="Kulit" size="md" />
                  <Avatar name="Mochi" size="sm" />
                </div>
                <p className={NOTE}>Without a photo, avatars show initials on a soft blue disc.</p>
              </Card>
            </div>
            <Card titleAs="h3" title="Photo ratios">
              <Photo ratio="cover" alt="Cover photo of Happy Paws foster home" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Photo alt="Mochi in the garden" />
                <Photo alt="Mochi asleep" />
                <Photo ratio="square" alt="Kulit by the window" />
                <Photo ratio="square" alt="Kulit playing" />
              </div>
            </Card>
          </div>
        </section>

        {/* ---------- Text fields ---------- */}
        <section aria-labelledby="fields" className={SECTION}>
          <div className={INTRO}>
            <h2 id="fields" className="text-2xl">Text fields</h2>
            <p className={NOTE}>
              Label above, helper text below, errors inline and linked to the field so screen readers read them.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <Card titleAs="h3" title="Input and select">
              <Field label="Email" hint="We'll send the verification result here.">
                <Input type="email" autoComplete="email" placeholder="you@email.com" />
              </Field>
              <Field label="City" error="Enter the city where your pet lives.">
                <Input autoComplete="address-level2" defaultValue="" />
              </Field>
              <Field label="Species">
                <Select placeholder="Choose a species" options={["Dog", "Cat", "Other"]} />
              </Field>
              <Field label="Nickname" optional disabled hint="Disabled until you save your name.">
                <Input />
              </Field>
            </Card>
            <Card titleAs="h3" title="Text area and locked fields">
              <Field label="Cover letter" hint="Write as your pet, in first person. 50 to 600 characters.">
                <Textarea
                  minLength={50}
                  maxLength={600}
                  rows={4}
                  placeholder="Hi Ana! I'm Mochi, and I think your home is my kind of place…"
                />
              </Field>
              <LockedFieldDemo />
            </Card>
          </div>
        </section>

        {/* ---------- Choices ---------- */}
        <section aria-labelledby="choices" className={SECTION}>
          <div className={INTRO}>
            <h2 id="choices" className="text-2xl">Choices</h2>
            <p className={NOTE}>
              Chips for quick answers, radio cards when each option needs a line of explanation, a toggle for settings
              that apply right away.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <Card titleAs="h3" title="Choice chips">
              <ChoiceChips legend="Energy level" options={["Relaxed", "Moderate", "Active"]} defaultValue="Active" />
              <ChoiceChips
                legend="Personality"
                hint="Pick all that fit."
                multiple
                options={["Playful", "Calm", "Loyal", "Curious", "Shy"]}
                defaultValue={["Playful", "Loyal"]}
              />
              <ChoiceChips
                legend="Good with kids?"
                options={["Yes", "No", "Not sure"]}
                error="Choose an answer to continue."
              />
            </Card>
            <Card titleAs="h3" title="Radio cards">
              <RadioCards
                legend="What should happen to this post?"
                defaultValue="remove"
                options={[
                  { value: "remove", label: "Remove the content", description: "Can be restored later." },
                  { value: "suspend", label: "Suspend the account", description: "The owner sees your reason." },
                  { value: "dismiss", label: "Dismiss the report", description: "Nothing changes for the owner." },
                ]}
              />
            </Card>
            <Card titleAs="h3" title="Toggle">
              <Toggle label="Open to Adopt" description="Let pets send me adoption requests." defaultChecked />
              <Toggle label="Email me about new matches" labelPosition="start" />
              <Toggle label="Weekly summary" labelPosition="start" disabled />
            </Card>
            <Card titleAs="h3" title="Checkbox">
              <Fieldset legend="Other pets at home" hint="Pick all that apply." optional>
                <Checkbox name="pets" value="dogs" label="Dogs" defaultChecked />
                <Checkbox name="pets" value="cats" label="Cats" />
                <Checkbox name="pets" value="other" label="Other pets" description="Birds, rabbits, fish and others." />
              </Fieldset>
              <Checkbox
                label="I agree to the Terms and Community Guidelines"
                error="Agree to the Terms to create your account."
              />
            </Card>
          </div>
        </section>

        {/* ---------- File upload ---------- */}
        <section aria-labelledby="uploads" className={SECTION}>
          <div className={INTRO}>
            <h2 id="uploads" className="text-2xl">File upload</h2>
            <p className={NOTE}>
              JPG, PNG and PDF up to 5 MB, checked by content as well as by name. The server checks again; this is
              only for quick feedback.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <Card titleAs="h3" title="One document">
              <FileUpload label="Valid ID" hint="JPG, PNG or PDF, up to 5 MB. Only admins can see it." />
            </Card>
            <Card titleAs="h3" title="Several photos">
              <FileUpload label="Pet photos" accept={["jpg", "png"]} multiple maxFiles={3} />
            </Card>
          </div>
        </section>

        {/* ---------- Wizard ---------- */}
        <section aria-labelledby="wizard" className={SECTION}>
          <div className={INTRO}>
            <h2 id="wizard" className="text-2xl">Stepper and wizard</h2>
            <p className={NOTE}>
              Long forms are split into steps with a visible &ldquo;Step X of N&rdquo; (NFR1). Answers survive Back and
              Next. Try Next with the first step empty.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Card titleAs="h3" title="Stepper on its own">
              <Stepper steps={["Account", "Details", "Photo", "ID", "Review"]} current={2} />
            </Card>
            <Card>
              <WizardDemo />
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}
