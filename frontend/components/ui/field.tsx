import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";

interface FieldShellProps {
  label: string;
  hint?: string;
  /** Hide the visible label but keep it as the accessible name. */
  labelHidden?: boolean;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}

function FieldShell({ label, hint, labelHidden = false, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="ui-field">
      <label className={labelHidden ? "sr-only" : "ui-field-label"} htmlFor={id}>{label}</label>
      {children({ id, describedBy: hintId })}
      {hint && <span className="ui-field-hint" id={hintId}>{hint}</span>}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  labelHidden?: boolean;
}

export function TextField({ label, hint, labelHidden, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} labelHidden={labelHidden}>
      {({ id, describedBy }) => <input id={id} className="ui-input" aria-describedby={describedBy} {...rest} />}
    </FieldShell>
  );
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  hint?: string;
  labelHidden?: boolean;
}

export function SelectField({ label, hint, labelHidden, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} labelHidden={labelHidden}>
      {({ id, describedBy }) => <select id={id} className="ui-select" aria-describedby={describedBy} {...rest}>{children}</select>}
    </FieldShell>
  );
}
