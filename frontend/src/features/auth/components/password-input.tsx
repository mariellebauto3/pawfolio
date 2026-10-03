"use client";

import { type ComponentProps, useState } from "react";
import { Input } from "@/components/forms/input";
import { cn } from "@/lib/utils/cn";

type Props = Omit<ComponentProps<typeof Input>, "type">;

// A password Input with a Show / Hide button, so people can check what they typed (helpful on phones). Goes inside a
// Field like any Input. The button names its action and says whether the password is showing.
export function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-20", className)} />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-1 my-auto flex min-h-11 items-center rounded-control px-3 text-sm font-bold text-primary hover:bg-primary-soft"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
