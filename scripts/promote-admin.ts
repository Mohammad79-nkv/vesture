// Promotes a Vesture user to the ADMIN role end-to-end:
//   - Updates their User.role in the DB
//   - Mirrors the change to Clerk's publicMetadata.role
//
// Usage:
//   pnpm tsx scripts/promote-admin.ts user@example.com
//
// Why this exists: the very first admin can't be created from the in-app
// /admin/users panel (because nobody has access to it yet). Two manual paths
// otherwise — opening the Neon console to update a row, or editing Clerk
// metadata in their dashboard — are both error-prone and easy to forget. A
// one-shot script keeps the bootstrap reproducible and survives DB resets.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { clerkClient } from "@clerk/nextjs/server";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: (process.env.DIRECT_URL ?? process.env.DATABASE_URL) as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: pnpm tsx scripts/promote-admin.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email "${email}".`);
    console.error(
      "Sign up through /onboarding/sign-up first, then re-run this script.",
    );
    process.exit(2);
  }

  if (user.role === "ADMIN") {
    console.log(`User ${email} is already ADMIN — nothing to do.`);
    process.exit(0);
  }

  // Update Clerk first so a partial DB write doesn't leave them rolePrivileged
  // locally without their session reflecting it.
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(user.clerkId, {
    publicMetadata: { role: "ADMIN" },
  });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
    select: { id: true, email: true, role: true },
  });

  console.log("✓ Promoted to ADMIN:");
  console.log(`  email   ${updated.email}`);
  console.log(`  role    ${updated.role}`);
  console.log(`  user.id ${updated.id}`);
  console.log("");
  console.log(
    "The user must sign out and back in (or wait for a session refresh) for",
  );
  console.log("Clerk's publicMetadata to flow through to client components.");
}

main()
  .catch((err) => {
    console.error("promote-admin failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
