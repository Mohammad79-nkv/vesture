import { NextResponse, type NextRequest } from "next/server";
import { signUpload } from "@/lib/adapters/cloudinary";
import { prisma } from "@/lib/adapters/prisma";
import { auth } from "@clerk/nextjs/server";

// Returns a one-shot signature the browser uses to PUT directly to
// Cloudinary. Bytes never touch our server, so this scales without
// per-byte egress cost.
//
// `kind=product` (default): approved sellers uploading product photos.
// `kind=closet`: any signed-in user uploading their own closet pieces.
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "closet" ? "closet" : "product";

  if (kind === "closet") {
    const dbUser = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(signUpload({ kind: "closet", userId: dbUser.id }));
  }

  const seller = await prisma.sellerProfile.findFirst({
    where: { user: { clerkId }, status: "APPROVED" },
    select: { id: true },
  });
  if (!seller) {
    return NextResponse.json({ error: "Seller not approved" }, { status: 403 });
  }

  return NextResponse.json(signUpload({ kind: "product", sellerId: seller.id }));
}
