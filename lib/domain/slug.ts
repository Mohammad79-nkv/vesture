import { customAlphabet } from "nanoid";

const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Append a short random suffix so titles don't collide. The suffix also
// makes slugs effectively unguessable, which we rely on for draft URLs.
export function makeSlug(input: string): string {
  const base = slugify(input);
  const suffix = slugSuffix();
  return base ? `${base}-${suffix}` : suffix;
}
