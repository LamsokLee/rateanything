/**
 * Client-side tRPC hooks — configures the tRPC+React Query integration.
 * Import { trpc } from this file in components to call API procedures.
 */
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/root';

/** Typed tRPC React hooks - explicit return type to avoid cross-package type inference issues */
export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> = createTRPCReact<AppRouter>();
