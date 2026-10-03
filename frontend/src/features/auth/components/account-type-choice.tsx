import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon, type IconName } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";

type Choice = { href: string; icon: IconName; title: string; description: string; action: string };

const CHOICES: Choice[] = [
  {
    href: ROUTES.signUpPet,
    icon: "paw",
    title: "I'm a pet",
    description: "A caretaker (foster, finder or shelter volunteer) signs up on the pet's behalf and gets verified.",
    action: "Sign up a pet",
  },
  {
    href: ROUTES.signUpHuman,
    icon: "user",
    title: "I want to adopt",
    description: "Build a Home Profile, get matched, and review adoption requests from pets. You must be 18 or older.",
    action: "Sign up to adopt",
  },
];

// AU-07 Join: the two public account types (FR1, FR18). Admin accounts are never created here (SEC-AUTH-10).
// The whole card is the link's hit area; the button inside it is the link, so it has one clear name.
export function AccountTypeChoice() {
  return (
    <div className="mx-auto flex w-full max-w-narrow flex-col gap-6 px-gutter py-8 md:py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Join Pawfolio</h1>
        <p className="text-ink-muted">Pick the kind of account. One account is one pet, or one person.</p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {CHOICES.map((choice) => (
          <li
            key={choice.href}
            className="relative flex flex-col gap-4 rounded-card border border-line bg-surface p-4 transition-colors duration-200 ease-out hover:border-primary md:p-5"
          >
            <span aria-hidden="true" className="grid h-28 place-items-center rounded-control bg-sky-soft text-primary">
              <Icon name={choice.icon} className="size-12" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl">{choice.title}</h2>
              <p className="text-sm text-ink-muted">{choice.description}</p>
            </div>
            <Link
              href={choice.href}
              className={buttonClasses({ size: "sm", className: "mt-auto self-start after:absolute after:inset-0 after:rounded-card" })}
            >
              {choice.action}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href={ROUTES.signIn} className="font-bold text-primary underline hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </div>
  );
}
