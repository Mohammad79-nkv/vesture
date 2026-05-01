import { prisma } from "@/lib/adapters/prisma";
import { makeSlug } from "@/lib/domain/slug";
import {
  sellerOnboardingSchema,
  type SellerOnboardingInput,
} from "@/lib/domain/schemas";
import type { SellerProfile, SellerStatus } from "@prisma/client";

// ─── Onboarding ─────────────────────────────────────────────────────────

export async function submitSellerApplication(
  userId: string,
  raw: unknown,
): Promise<SellerProfile> {
  const input = sellerOnboardingSchema.parse(raw) satisfies SellerOnboardingInput;

  const existing = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (existing) {
    return prisma.sellerProfile.update({
      where: { userId },
      data: {
        storeNameEn: input.storeNameEn,
        storeNameAr: input.storeNameAr,
        bioEn: input.bioEn,
        bioAr: input.bioAr,
        countryCode: input.countryCode,
        defaultCurrency: input.defaultCurrency,
        instagramUrl: input.instagramUrl,
        whatsappE164: input.whatsappE164,
        // Re-applying after rejection puts the seller back in the queue.
        status: existing.status === "REJECTED" ? "PENDING" : existing.status,
        rejectionReason: existing.status === "REJECTED" ? null : existing.rejectionReason,
      },
    });
  }

  return prisma.sellerProfile.create({
    data: {
      userId,
      storeNameEn: input.storeNameEn,
      storeNameAr: input.storeNameAr,
      bioEn: input.bioEn,
      bioAr: input.bioAr,
      countryCode: input.countryCode,
      defaultCurrency: input.defaultCurrency,
      instagramUrl: input.instagramUrl,
      whatsappE164: input.whatsappE164,
      slug: makeSlug(input.storeNameEn),
      status: "PENDING",
    },
  });
}

// ─── Admin moderation ───────────────────────────────────────────────────

export async function approveSeller(args: {
  adminId: string;
  sellerId: string;
}): Promise<SellerProfile> {
  return prisma.$transaction(async (tx) => {
    const seller = await tx.sellerProfile.update({
      where: { id: args.sellerId },
      data: { status: "APPROVED", approvedAt: new Date(), rejectionReason: null },
    });
    // Promote the user to SELLER role on first approval.
    await tx.user.update({
      where: { id: seller.userId },
      data: { role: "SELLER" },
    });
    await tx.adminAction.create({
      data: {
        adminId: args.adminId,
        targetType: "Seller",
        targetId: args.sellerId,
        action: "APPROVE",
      },
    });
    return seller;
  });
}

export async function rejectSeller(args: {
  adminId: string;
  sellerId: string;
  reason: string;
}): Promise<SellerProfile> {
  return prisma.$transaction(async (tx) => {
    const seller = await tx.sellerProfile.update({
      where: { id: args.sellerId },
      data: { status: "REJECTED", rejectionReason: args.reason, approvedAt: null },
    });
    await tx.adminAction.create({
      data: {
        adminId: args.adminId,
        targetType: "Seller",
        targetId: args.sellerId,
        action: "REJECT",
        reason: args.reason,
      },
    });
    return seller;
  });
}

// ─── Queries ────────────────────────────────────────────────────────────

export function getSellerByUserId(userId: string) {
  return prisma.sellerProfile.findUnique({ where: { userId } });
}

export function listSellersByStatus(status: SellerStatus) {
  return prisma.sellerProfile.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });
}

// Approved sellers for the marketing landing's "Featured sellers" section.
// Returns the slice + the total approved count for the "Browse all N" link.
export async function listFeaturedSellers(limit = 6) {
  const [items, totalApproved] = await Promise.all([
    prisma.sellerProfile.findMany({
      where: { status: "APPROVED" },
      orderBy: { approvedAt: "desc" },
      take: limit,
      select: {
        id: true,
        slug: true,
        storeNameEn: true,
        storeNameAr: true,
        countryCode: true,
      },
    }),
    prisma.sellerProfile.count({ where: { status: "APPROVED" } }),
  ]);
  return { items, totalApproved };
}

export function getSellerBySlug(slug: string) {
  return prisma.sellerProfile.findUnique({
    where: { slug, status: "APPROVED" },
    include: {
      products: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        include: { images: { orderBy: { position: "asc" }, take: 1 } },
      },
    },
  });
}
