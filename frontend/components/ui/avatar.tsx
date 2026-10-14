import Image from "next/image";

export interface AvatarProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  size?: number;
}

/** Two-character initials derived from a display name, then the email. */
export function initialsOf(name?: string | null, email?: string | null): string {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) return "?";
  const words = source.split(/[\s._@-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function Avatar({ name, email, image, size = 28 }: AvatarProps) {
  return (
    <span className="ui-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {image
        ? <Image src={image} alt="" width={size} height={size} unoptimized />
        : initialsOf(name, email)}
    </span>
  );
}
