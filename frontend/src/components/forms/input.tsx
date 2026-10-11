"use client";

import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils/cn";
import { CONTROL_CLASSES, READ_ONLY_CLASSES } from "./control-styles";
import { useFieldControl } from "./field-context";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
};

// Text-like input. Put it inside a Field for its label, hint and error. Use the right `type` and `autoComplete`
// (email, tel, new-password…) so phones show the right keyboard and password managers work.
export function Input({ className, ...props }: Props) {
  const field = useFieldControl(props);
  return <input {...props} {...field} className={cn(CONTROL_CLASSES, READ_ONLY_CLASSES, className)} />;
}
