/**
 * tRPC HTTP handler — routes all /api/trpc/* requests to the app router.
 * Uses Clerk auth for production.
 */
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { safeAuth } from "@/lib/safe-auth";
import { appRouter } from "@/server/root";
import { createTRPCContext } from "@/server/trpc";

const handler = async (req: Request) => {
  const clerkAuth = await safeAuth();
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ clerkUserId: clerkAuth.userId ?? null, req }),
  });
};

export { handler as GET, handler as POST };
