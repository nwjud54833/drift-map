import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "aside";
  /** Border radius: card (10px) or the larger panel radius (14px). */
  radius?: "card" | "panel";
  tone?: "surface" | "raised";
  children?: ReactNode;
}

/** Surface container. Padding is applied by the caller's own layout class. */
export function Card({ as: Tag = "div", radius = "card", tone = "surface", className, children, ...rest }: CardProps) {
  const classes = ["ui-card", radius === "panel" ? "ui-card-panel" : "", tone === "raised" ? "ui-card-raised" : "", className ?? ""].filter(Boolean).join(" ");
  return <Tag className={classes} {...rest}>{children}</Tag>;
}

export function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={["ui-card-header", className ?? ""].filter(Boolean).join(" ")} {...rest}>{children}</div>;
}
