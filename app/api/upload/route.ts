import { NextResponse } from "next/server";
import { signUpload } from "@/lib/adapters/cloudinary";
import { prisma } from "@/lib/adapters/prisma";
import { auth } from "@clerk/nextjs/server";

// Returns a one-shot signature the browser uses to PUT directly to
// Cloudinary. Bytes never touch our server, so this scales without
// per-byte egress cost. Sellers only — buyers don't upload anything.
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seller = await prisma.sellerProfile.findFirst({
    where: { user: { clerkId: userId }, status: "APPROVED" },
    select: { id: true },
  });
  if (!seller) {
    return NextResponse.json({ error: "Seller not approved" }, { status: 403 });
  }

  const sig = signUpload({ sellerId: seller.id });
  return NextResponse.json(sig);
}
