import createIntlMiddleware from "next-intl/middleware";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { routing } from "@/lib/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// API routes have no locale prefix and should bypass the intl middleware.
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

// Routes that require an authenticated session. The intl middleware still
// runs first so the locale prefix is applied; Clerk gates after redirect.
const isProtectedRoute = createRouteMatcher([
  "/:locale/dashboard(.*)",
  "/:locale/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isApiRoute(req)) {
    if (isProtectedRoute(req)) await auth.protect();
    return NextResponse.next();
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  return intlMiddleware(req);
});

export const config = {
  // Match everything except static files, _next, and image optimization.
  matcher: ["/((?!_next|.*\\..*).*)"],
};
