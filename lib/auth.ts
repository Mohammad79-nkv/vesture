import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/adapters/prisma";
import type { Role, User } from "@prisma/client";

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

// Fetch (or lazily create) the User row that mirrors the current Clerk user.
// The Clerk webhook is the primary creator, but in dev it can race the first
// request, so we upsert defensively here too.
export async function getOrCreateDbUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  return prisma.user.upsert({
    where: { clerkId: userId },
    update: { email },
    create: { clerkId: userId, email, role: "BUYER" },
  });
}

export async function requireUser(): Promise<User> {
  const user = await getOrCreateDbUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireRole(role: Role): Promise<User> {
  const user = await requireUser();
  if (user.role !== role && user.role !== "ADMIN") {
    throw new AuthError(403, `Requires role ${role}`);
  }
  return user;
}

export const requireSeller = () => requireRole("SELLER");
export const requireAdmin = () => requireRole("ADMIN");
