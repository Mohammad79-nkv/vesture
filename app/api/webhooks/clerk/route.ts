import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/adapters/prisma";

// Clerk → Vesture user sync. Configure the endpoint in Clerk dashboard
// (Webhooks → Add Endpoint) at <APP_URL>/api/webhooks/clerk and subscribe
// to user.created, user.updated, user.deleted. Paste the signing secret
// into CLERK_WEBHOOK_SECRET.
type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    email_addresses?: { id: string; email_address: string }[];
    primary_email_address_id?: string | null;
    public_metadata?: { role?: string };
  };
};

function pickPrimaryEmail(data: ClerkUserEvent["data"]): string | null {
  const emails = data.email_addresses ?? [];
  if (emails.length === 0) return null;
  const primary = emails.find((e) => e.id === data.primary_email_address_id);
  return primary?.email_address ?? emails[0]?.email_address ?? null;
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);
  let evt: ClerkUserEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const clerkId = evt.data.id;

  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const email = pickPrimaryEmail(evt.data);
      if (!email) {
        return NextResponse.json({ error: "No email on user" }, { status: 400 });
      }
      const role = evt.data.public_metadata?.role;
      const validRole = role === "SELLER" || role === "ADMIN" ? role : "BUYER";

      await prisma.user.upsert({
        where: { clerkId },
        create: { clerkId, email, role: validRole },
        update: { email, role: validRole },
      });
      break;
    }
    case "user.deleted": {
      await prisma.user.deleteMany({ where: { clerkId } });
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
