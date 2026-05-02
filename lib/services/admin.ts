import { prisma } from "@/lib/adapters/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import type { AdminAction, ProductStatus, Role } from "@prisma/client";

// ─── Stats ──────────────────────────────────────────────────────────────

export async function adminOverviewStats() {
  const [pendingSellers, approvedSellers, liveProducts, totalUsers] = await Promise.all([
    prisma.sellerProfile.count({ where: { status: "PENDING" } }),
    prisma.sellerProfile.count({ where: { status: "APPROVED" } }),
    prisma.product.count({ where: { status: "PUBLISHED" } }),
    prisma.user.count(),
  ]);
  return { pendingSellers, approvedSellers, liveProducts, totalUsers };
}

// ─── Audit log ──────────────────────────────────────────────────────────

export type EnrichedAdminAction = AdminAction & {
  adminEmail: string;
  targetLabel: string;
};

// Resolve adminId → admin email and targetId → human-readable label so the
// audit log doesn't show bare cuids.
async function enrichActions(actions: AdminAction[]): Promise<EnrichedAdminAction[]> {
  if (actions.length === 0) return [];

  const adminIds = [...new Set(actions.map((a) => a.adminId))];
  const sellerTargets = actions.filter((a) => a.targetType === "Seller").map((a) => a.targetId);
  const productTargets = actions.filter((a) => a.targetType === "Product").map((a) => a.targetId);
  const userTargets = actions.filter((a) => a.targetType === "User").map((a) => a.targetId);

  const [admins, sellers, products, users] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } }),
    sellerTargets.length
      ? prisma.sellerProfile.findMany({ where: { id: { in: sellerTargets } }, select: { id: true, storeNameEn: true } })
      : Promise.resolve([]),
    productTargets.length
      ? prisma.product.findMany({ where: { id: { in: productTargets } }, select: { id: true, titleEn: true } })
      : Promise.resolve([]),
    userTargets.length
      ? prisma.user.findMany({ where: { id: { in: userTargets } }, select: { id: true, email: true } })
      : Promise.resolve([]),
  ]);

  const adminMap = new Map(admins.map((a) => [a.id, a.email]));
  const sellerMap = new Map(sellers.map((s) => [s.id, s.storeNameEn]));
  const productMap = new Map(products.map((p) => [p.id, p.titleEn]));
  const userMap = new Map(users.map((u) => [u.id, u.email]));

  return actions.map((a) => {
    let targetLabel = a.targetId.slice(-8);
    if (a.targetType === "Seller") targetLabel = sellerMap.get(a.targetId) ?? targetLabel;
    else if (a.targetType === "Product") targetLabel = productMap.get(a.targetId) ?? targetLabel;
    else if (a.targetType === "User") targetLabel = userMap.get(a.targetId) ?? targetLabel;
    return {
      ...a,
      adminEmail: adminMap.get(a.adminId) ?? a.adminId.slice(-8),
      targetLabel,
    };
  });
}

export async function listRecentAdminActions(limit = 10) {
  const actions = await prisma.adminAction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return enrichActions(actions);
}

export async function listAuditLog({ skip = 0, take = 50 } = {}) {
  const [items, total] = await Promise.all([
    prisma.adminAction.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
    prisma.adminAction.count(),
  ]);
  return { items: await enrichActions(items), total };
}

// ─── Products (admin scope) ─────────────────────────────────────────────

export async function listProductsAdmin(args: {
  search?: string;
  status?: ProductStatus | "ALL";
  page?: number;
  pageSize?: number;
}) {
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? 20;
  const where = {
    ...(args.search
      ? {
          OR: [
            { titleEn: { contains: args.search, mode: "insensitive" as const } },
            { titleAr: { contains: args.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(args.status && args.status !== "ALL" ? { status: args.status } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        seller: { select: { slug: true, storeNameEn: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function forceArchiveProduct(args: {
  adminId: string;
  productId: string;
  reason: string;
}) {
  return prisma.$transaction([
    prisma.product.update({
      where: { id: args.productId },
      data: { status: "ARCHIVED" },
    }),
    prisma.adminAction.create({
      data: {
        adminId: args.adminId,
        targetType: "Product",
        targetId: args.productId,
        action: "ARCHIVE",
        reason: args.reason || null,
      },
    }),
  ]);
}

// ─── Users (admin scope) ────────────────────────────────────────────────

export async function listUsersAdmin(args: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? 25;
  const where = args.search
    ? { email: { contains: args.search, mode: "insensitive" as const } }
    : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sellerProfile: { select: { storeNameEn: true, status: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// Updates a user's role in both Clerk (publicMetadata) and our DB. Clerk
// runs first — if it fails we abort. The webhook will eventually re-affirm
// the DB row, so even if the local update somehow fails the system stays
// consistent. Logged in AdminAction either way.
export async function changeUserRole(args: {
  adminId: string;
  targetUserId: string;
  newRole: Role;
}) {
  const target = await prisma.user.findUnique({
    where: { id: args.targetUserId },
    select: { id: true, clerkId: true, role: true },
  });
  if (!target) throw new Error("User not found");
  if (target.role === args.newRole) return target;

  const client = await clerkClient();
  await client.users.updateUserMetadata(target.clerkId, {
    publicMetadata: { role: args.newRole },
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: args.targetUserId },
      data: { role: args.newRole },
    }),
    prisma.adminAction.create({
      data: {
        adminId: args.adminId,
        targetType: "User",
        targetId: target.id,
        action: `ROLE_${args.newRole}`,
      },
    }),
  ]);

  return { ...target, role: args.newRole };
}
