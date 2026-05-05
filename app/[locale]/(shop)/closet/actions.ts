"use server";

import { revalidatePath } from "next/cache";
import { redirect as redirectRaw } from "next/navigation";
import { requireUser } from "@/lib/auth";

// next/navigation's redirect is typed against the static route map, but our
// dynamic /closet/[id] target is a template string — a known limitation of
// Next 16's typed routes when concatenating ids. The cast is local to this
// module so callers stay clean.
const redirect = redirectRaw as unknown as (path: string) => never;
import {
  closetPieceInputSchema,
  type ClosetPieceInput,
} from "@/lib/domain/schemas";
import {
  createPiece,
  updatePiece,
  setPieceStatus,
  logWear,
  deletePiece,
} from "@/lib/services/closet";
import type { PieceStatus } from "@prisma/client";

export async function createPieceAction(input: ClosetPieceInput) {
  const user = await requireUser();
  const parsed = closetPieceInputSchema.parse(input);
  const piece = await createPiece({ userId: user.id, input: parsed });
  revalidatePath("/closet", "layout");
  redirect(`/closet/${piece.id}`);
}

export async function updatePieceAction(
  pieceId: string,
  input: Partial<ClosetPieceInput>,
) {
  const user = await requireUser();
  const parsed = closetPieceInputSchema.partial().parse(input);
  await updatePiece({ userId: user.id, pieceId, input: parsed });
  revalidatePath("/closet", "layout");
  revalidatePath(`/closet/${pieceId}`);
}

export async function setPieceStatusAction(pieceId: string, status: PieceStatus) {
  const user = await requireUser();
  await setPieceStatus({ userId: user.id, pieceId, status });
  revalidatePath("/closet", "layout");
  revalidatePath(`/closet/${pieceId}`);
}

export async function logWearAction(pieceId: string) {
  const user = await requireUser();
  await logWear({ userId: user.id, pieceId });
  revalidatePath("/closet", "layout");
  revalidatePath(`/closet/${pieceId}`);
}

export async function deletePieceAction(pieceId: string) {
  const user = await requireUser();
  await deletePiece({ userId: user.id, pieceId });
  revalidatePath("/closet", "layout");
  redirect("/closet");
}
