import Image from "next/image";
import { LANDING_SECTIONS } from "@/constants/routes";
import { FaqLineList } from "./faq-line-list";
import { PawMark } from "./landing-illustrations";

// Answers come from the proposal's rules (project-rules/, docs/requirements/). Keep them in step when a rule changes.
const QUESTIONS = [
  {
    question: "Who looks after a pet's account?",
    answer:
      "The person caring for the pet right now signs it up, submits their own ID, and writes the resume in the pet's voice.",
  },
  {
    question: "Why do I need to send an ID?",
    answer:
      "A Pawfolio admin checks every account before it can send or receive requests. It keeps out fake profiles and people looking to sell animals. Only admins ever see your ID.",
  },
  {
    question: "Who sees my address and phone number?",
    answer:
      "No one, until a Meet & Greet is confirmed. Then only the pet's caretaker and the human on that request see them. Your public profile shows just your city and a summary of your household.",
  },
  {
    question: "How are pets and homes matched?",
    answer:
      "Humans take a lifestyle quiz. Pairs that can't work are left out first: the wrong species, kids or other pets the pet can't live with, or a different province. The rest get a match score with its top reasons.",
  },
  {
    question: "How many homes can a pet apply to?",
    answer:
      "Up to three at a time. When a human approves one request, the others wait On Hold until that one ends.",
  },
  {
    question: "Can I buy or sell a pet here?",
    answer:
      "No. Pawfolio is for adoption only. Report any profile, post or message that asks for money, and an admin will look into it.",
  },
];

// AU-01 FAQ, as a line list (faq-line-list.tsx). The guest top bar, the footer and the account-status "Help center"
// link here (HELP_CENTER_PATH). From lg up the left column holds the heading, who answers and the cat applicant below
// them. On smaller screens it sits above the questions, with the cat small beside the text so the questions stay close.
export function LandingFaq() {
  return (
    <section
      id={LANDING_SECTIONS.faq}
      aria-labelledby="faq-title"
      className="scroll-mt-16 border-t border-line bg-surface px-gutter py-16 md:py-24"
    >
      <div className="mx-auto flex max-w-content flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:items-start lg:gap-16">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] content-start gap-x-4 gap-y-4 lg:flex lg:flex-col">
          <h2 id="faq-title" className="text-3xl md:text-4xl">
            {/* accent-display: the one yellow that stays readable as text on white, at this size only (HiFi rule 4). */}
            <span className="font-bold text-accent-display">Questions</span>{" "}
            people ask
          </h2>
          <p className="max-w-[40ch] text-lg text-ink-muted">
            Straight answers on safety, privacy and how adoption works here.
          </p>
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-pill bg-primary text-primary-ink">
              <PawMark className="size-3.5 fill-current" />
            </span>
            Answered by the Pawfolio team
          </p>
          <Image
            src="/images/illustrations/faq-cat-applicant.webp"
            width={953}
            height={1389}
            alt="A ginger cat in a suit and tie, head tilted, wearing a Job applicant badge"
            sizes="(min-width: 1024px) 232px, (min-width: 640px) 128px, 96px"
            className="col-start-2 row-span-3 row-start-1 w-24 self-end sm:w-32 lg:mt-4 lg:w-58 lg:self-start"
          />
        </div>

        <div className="lg:pt-2">
          <FaqLineList items={QUESTIONS} />
        </div>
      </div>
    </section>
  );
}
