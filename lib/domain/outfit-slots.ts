// Pure constants + helpers for the outfit builder. Lives in `lib/domain`
// because both the client (the builder UI) and the service layer (the
// Prisma writes) need to share the slot vocabulary, and the service file
// can't be imported from a client component (it pulls in prisma → pg →
// node:dns, which the browser bundle can't resolve).

export const OUTFIT_SLOTS = [
  "TOP",
  "BOTTOM",
  "DRESS",
  "OUTER",
  "SHOES",
  "BAG",
  "ACCESSORY",
] as const;
export type OutfitSlot = (typeof OUTFIT_SLOTS)[number];

export function isOutfitSlot(value: string): value is OutfitSlot {
  return (OUTFIT_SLOTS as readonly string[]).includes(value);
}

// Map a Prisma Category to its default mannequin slot. The picker on the
// client always knows the slot when adding (the user tapped a piece in a
// category-filtered rail), but we expose this for places that only have a
// piece reference.
export function defaultSlotForCategory(category: string): OutfitSlot | null {
  switch (category) {
    case "TOPS":
      return "TOP";
    case "BOTTOMS":
      return "BOTTOM";
    case "DRESSES":
      return "DRESS";
    case "OUTERWEAR":
      return "OUTER";
    case "SHOES":
      return "SHOES";
    case "BAGS":
      return "BAG";
    case "ACCESSORIES":
      return "ACCESSORY";
    default:
      return null;
  }
}

// Slots that conflict with the slot being filled. DRESS clears TOP+BOTTOM;
// TOP/BOTTOM clear DRESS; everything else has no conflicts.
export function conflictingSlots(slot: OutfitSlot): OutfitSlot[] {
  if (slot === "DRESS") return ["TOP", "BOTTOM"];
  if (slot === "TOP" || slot === "BOTTOM") return ["DRESS"];
  return [];
}
