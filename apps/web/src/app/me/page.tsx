/**
 * /me — redirects authenticated users to their profile page.
 * Unauthenticated users are redirected to home (which has the sign-in modal).
 * Gracefully degrades if Clerk is in dev-bypass mode or user has no DB record.
 */
import { redirect } from "next/navigation";
import { safeAuth } from "@/lib/safe-auth";
import { db, users, eq } from "@rateanything/db";

export default async function MePage() {
  const { userId } = await safeAuth();

  if (!userId) {
    redirect("/");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!user) {
    // Signed in but no DB record yet — redirect home rather than crashing
    redirect("/");
  }

  redirect(`/user/${user.username}`);
}
