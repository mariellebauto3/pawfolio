import { Icon } from "@/components/ui/icon";
import { PASSWORD_RULES, passwordStrength } from "@/lib/auth/password-rules";
import { cn } from "@/lib/utils/cn";

type Props = {
  password: string;
  id?: string;
};

// Under the new-password field (AU-06): a four-step strength meter with its word, and the three rules ticking off as
// they are met. The word and the ticks carry the meaning, so colour never works alone. The rules are announced
// politely as they change, through the live region.
export function NewPasswordGuide({ password, id }: Props) {
  const strength = passwordStrength(password);
  return (
    <div id={id} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="grid flex-1 grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={cn(
                "h-1.5 rounded-pill transition-colors duration-200",
                password && strength.score >= step ? "bg-primary" : "bg-surface-sunken",
              )}
            />
          ))}
        </div>
        <span className="w-20 text-right text-sm text-ink-muted" aria-live="polite">
          {password ? strength.label : ""}
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-sm" aria-label="Password rules">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li key={rule.id} className={cn("flex items-center gap-2", met ? "text-ink" : "text-ink-muted")}>
              <Icon
                name={met ? "circle-check" : "info"}
                className={cn("size-4 shrink-0", met ? "text-primary" : "text-ink-subtle")}
              />
              {rule.label}
              <span className="sr-only">{met ? "(done)" : "(not yet)"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
