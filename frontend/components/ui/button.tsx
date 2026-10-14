import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "outline" | "ghost" | "quiet" | "danger" | "gradient";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "ui-btn-primary",
  outline: "",
  ghost: "ui-btn-ghost",
  quiet: "ui-btn-quiet",
  danger: "ui-btn-danger",
  gradient: "ui-btn-gradient",
};

/**
 * Single button primitive. Visual variant only — all behaviour (`type`,
 * `disabled`, `onClick`, `aria-*`) passes straight through to the element.
 */
export function Button({ variant = "outline", size = "md", block = false, className, type = "button", children, ...rest }: ButtonProps) {
  const classes = ["ui-btn", size === "sm" ? "ui-btn-sm" : size === "lg" ? "ui-btn-lg" : "", VARIANT_CLASS[variant], block ? "ui-btn-block" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...rest}>{children}</button>;
}
