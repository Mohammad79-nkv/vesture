// Onboarding "Quick taste" picks. Stored as User.styleTags; the Phase-2
// stylist will read them as soft preferences. Keep these stable — renaming
// a label is fine, but don't drift the underlying tag string.
export const STYLE_TAGS = [
  "STREETWEAR",
  "QUIET_LUXURY",
  "MINIMAL",
  "ROMANTIC",
  "TAILORED",
  "EDITORIAL",
] as const;

export type StyleTag = (typeof STYLE_TAGS)[number];

export function isStyleTag(value: string): value is StyleTag {
  return (STYLE_TAGS as readonly string[]).includes(value);
}
