/**
 * /create — Topic creation page.
 * Server component: fetches categories, checks auth, renders form.
 * Requires authentication. Redirects unauthenticated users to home.
 */
import { redirect } from "next/navigation";
import { safeAuth } from "@/lib/safe-auth";
import { getServerCaller } from "@/lib/server-trpc";
import { CreateTopicForm } from "./CreateTopicForm";
import { db, categories as categoriesTable, asc } from "@rateanything/db";

export default async function CreatePage() {
  const { userId } = await safeAuth();

  if (!userId) {
    redirect("/");
  }

  // Fetch categories for the dropdown
  const categories = await db
    .select({ id: categoriesTable.id, name: categoriesTable.name, slug: categoriesTable.slug })
    .from(categoriesTable)
    .orderBy(asc(categoriesTable.id));

  return (
    <div className="space-y-6">
      <header className="space-y-2"
      >
        <h1 className="text-xl font-bold text-foreground">
          Create a New Topic
        </h1>
        <p className="text-sm text-muted-foreground">
          Define a topic and options for others to rate.
        </p>
      </header>

      <div className="rounded-lg border border-border/60 bg-card/50 p-5 sm:p-6">
        <CreateTopicForm categories={categories} />
      </div>
    </div>
  );
}
