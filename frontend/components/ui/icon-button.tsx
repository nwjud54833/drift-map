import type { ButtonHTMLAttributes, Ref } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons must have an accessible name. */
  label: string;
  bordered?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ label, bordered = false, className, type = "button", children, ref, ...rest }: IconButtonProps) {
  const classes = ["ui-icon-btn", bordered ? "ui-icon-btn-bordered" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button ref={ref} type={type} className={classes} aria-label={label} title={rest.title ?? label} {...rest}>
      {children}
    </button>
  );
}
