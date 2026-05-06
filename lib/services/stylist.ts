import { prisma } from "@/lib/adapters/prisma";
import type { ChatRole, Prisma } from "@prisma/client";

// Persistence layer for the stylist chat. The route handler in
// app/api/stylist/route.ts owns the streaming + LLM logic; this module
// owns "what's the row in the DB for this user / cookie / message?"
//
// Session strategy for now: one rolling session per user, re-used across
// all turns. A "Start new chat" UI surface will bump this — when it does,
// the bump is just a `prisma.chatSession.create({ data: { userId } })`,
// and findOrCreateSession picks the newest one. For Phase 2 we accept
// one continuous thread.

export async function findOrCreateSession(args: {
  userId: string | null;
  anonCookieSessionId: string | null;
}) {
  // Authed path: latest session for this user, or create.
  if (args.userId) {
    const existing = await prisma.chatSession.findFirst({
      where: { userId: args.userId },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
    return prisma.chatSession.create({
      data: { userId: args.userId },
    });
  }

  // Anon path: keyed by the cookie's sessionId. Note we use upsert so two
  // racing requests (rare on a dev tab, more likely on a flaky network)
  // don't create duplicate sessions for the same cookie.
  if (args.anonCookieSessionId) {
    return prisma.chatSession.upsert({
      where: { anonymousCookie: args.anonCookieSessionId },
      update: {},
      create: { anonymousCookie: args.anonCookieSessionId },
    });
  }

  throw new Error("findOrCreateSession requires userId or anonCookieSessionId");
}

// When an anonymous visitor signs up mid-conversation, transfer their
// existing session over so the auth'd user picks up where they left off.
// Cookie value is invalidated by clearing anonymousCookie (the cookie on
// the wire becomes orphaned; client will replace it on next anon traffic).
export async function attachAnonSession(args: {
  anonCookieSessionId: string;
  userId: string;
}) {
  await prisma.chatSession.updateMany({
    where: {
      anonymousCookie: args.anonCookieSessionId,
      userId: null,
    },
    data: {
      userId: args.userId,
      anonymousCookie: null,
    },
  });
}

// Append one chat message to a session. Tool calls go into the JSON column
// (debugging + future fine-tuning data); product mentions get stored
// individually in ChatMessageProduct so we can join across the catalog
// without parsing JSON. Dedupes productIds so a search_products that
// returns an item also returned by build_outfit doesn't violate the
// composite PK on (messageId, productId).
export async function appendMessage(args: {
  sessionId: string;
  role: ChatRole;
  content: string;
  toolCalls?: Prisma.InputJsonValue;
  productIds?: string[];
  // Prompt + completion tokens that produced this turn. Set on ASSISTANT
  // rows; the daily-budget query sums this column. USER rows leave it 0.
  tokensUsed?: number;
}) {
  const dedupedProductIds = args.productIds
    ? Array.from(new Set(args.productIds))
    : [];

  const message = await prisma.chatMessage.create({
    data: {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      tokensUsed: args.tokensUsed ?? 0,
      ...(args.toolCalls !== undefined && { toolCalls: args.toolCalls }),
      ...(dedupedProductIds.length > 0 && {
        products: {
          create: dedupedProductIds.map((productId, position) => ({
            productId,
            position,
          })),
        },
      }),
    },
  });

  // Bump session.updatedAt so "newest first" listing reflects activity.
  await prisma.chatSession.update({
    where: { id: args.sessionId },
    data: { updatedAt: new Date() },
  });

  return message;
}

// Sum of tokens this user has consumed since the start of the current UTC
// day. The bucket resets at 00:00 UTC; "today" is intentionally calendar-
// based rather than rolling-window so users get a predictable refresh
// they can talk about ("come back tomorrow").
//
// Anonymous traffic is NOT counted here — the 3-turn cookie wall covers
// it. This query only sums ASSISTANT rows that belong to a session with a
// userId set (joined via ChatSession.userId).
export async function tokensUsedTodayForUser(userId: string): Promise<number> {
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  const result = await prisma.chatMessage.aggregate({
    where: {
      role: "ASSISTANT",
      createdAt: { gte: startOfUtcDay },
      session: { userId },
    },
    _sum: { tokensUsed: true },
  });
  return result._sum.tokensUsed ?? 0;
}
