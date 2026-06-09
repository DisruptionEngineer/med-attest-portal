import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes — everything else requires a signed-in Clerk session.
// The Stripe webhook is public; it's authenticated by the signing secret
// (verified inside the route handler), not by Clerk.
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)', '/api/stripe/webhook']);

const clerkConfigured =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("PLACEHOLDER");

const authRedirectPaths = ["/", "/sign-in", "/sign-up"];

export default clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      const { userId } = await auth();

      // Redirect authenticated users away from landing/auth pages to dashboard
      if (userId && authRedirectPaths.some((p) => request.nextUrl.pathname === p ||
          (p !== "/" && request.nextUrl.pathname.startsWith(p + "/")))) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      // Protect non-public routes
      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    })
  : function fallbackMiddleware(_request: NextRequest) {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
