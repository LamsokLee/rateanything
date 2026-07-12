/**
 * Server-side tRPC caller — used in Server Components to call tRPC procedures
 * directly without HTTP round-trips.
 */
import { appRouter } from "@/server/root";
import { createTRPCContext } from "@/server/trpc";

/**
 * Creates a server-side caller for use in React Server Components.
 * Pass clerkUserId to authenticate the caller.
 */
export async function getServerCaller(clerkUserId?: string) {
  const ctx = await createTRPCContext({ clerkUserId: clerkUserId ?? null });
  return appRouter.createCaller(ctx);
}
