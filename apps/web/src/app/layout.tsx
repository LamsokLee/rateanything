/**
 * Root layout — AUTH ENABLED.
 * Clerk authentication for production deployment.
 */
import type { Metadata } from "next";
import Link from "next/link";
import "@/styles/globals.css";
import { NavSearch } from "@/components/NavSearch";
import { NavAuth } from "@/components/NavAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ClerkProviderClient } from "@/components/ClerkProviderClient";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "next-themes";
import { auth } from "@clerk/nextjs/server";
import type { InitialState } from "@clerk/types";

export const metadata: Metadata = {
  title: "RateAnything",
  description: "Rate anything. The world is watching.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131517" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // Get initial auth state for SSR hydration (only when Clerk is active)
  let initialState: InitialState | undefined = undefined;
  if (publishableKey && !publishableKey.includes("placeholder")) {
    try {
      const authState = await auth();
      initialState = authState ? { userId: authState.userId, sessionId: authState.sessionId } as InitialState : undefined;
    } catch {
      // auth() may fail if middleware didn't run; pass undefined
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkProviderClient publishableKey={publishableKey} initialState={initialState}>
            <AuthProvider>
              <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 gap-3">
                  <Link
                    href="/"
                    className="text-lg font-bold text-foreground transition-colors duration-200 hover:text-foreground/80 shrink-0"
                  >
                    RateAnything
                  </Link>

                  <div className="hidden sm:flex flex-1 max-w-sm mx-4">
                    <NavSearch />
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <ThemeToggle />
                    <NavAuth />
                  </div>
                </div>
              </nav>
              <main className="mx-auto max-w-5xl px-4 py-6 flex-1 w-full">
                {children}
              </main>
              <footer className="border-t border-border mt-12">
                <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-center">
                  <span className="text-[11px] text-subtle/70">
                    RateAnything © 2026 • Built for hot takes
                  </span>
                </div>
              </footer>
            </AuthProvider>
          </ClerkProviderClient>
        </ThemeProvider>
      </body>
    </html>
  );
}
