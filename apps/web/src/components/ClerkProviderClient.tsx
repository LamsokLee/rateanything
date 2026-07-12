"use client";

/**
 * ClerkProvider wrapper — client component that wraps children in ClerkProvider.
 * It receives initialState from the server layout for proper SSR hydration.
 * Dev-mode bypass: skips ClerkProvider when publishable key is missing or contains "placeholder".
 */
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import type { InitialState } from "@clerk/types";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  publishableKey?: string;
  initialState?: InitialState;
}

export function ClerkProviderClient({ children, publishableKey, initialState }: Props) {
  // Dev-mode bypass: skip Clerk entirely when using placeholder key
  if (!publishableKey || publishableKey.includes("placeholder")) {
    return <>{children}</>;
  }

  return (
    <ClerkProviderInner publishableKey={publishableKey} initialState={initialState}>
      {children}
    </ClerkProviderInner>
  );
}

/** Inner component that uses useTheme (must be rendered inside ThemeProvider) */
function ClerkProviderInner({ children, publishableKey, initialState }: Props) {
  const { resolvedTheme } = useTheme();

  return (
    <ClerkProvider
      publishableKey={publishableKey!}
      initialState={initialState}
      appearance={{
        baseTheme: resolvedTheme === "dark" ? dark : undefined,
        variables: {
          colorPrimary: "#3b82f6",
          colorBackground: resolvedTheme === "dark" ? "#1a1e23" : "#ffffff",
          colorText: resolvedTheme === "dark" ? "#fafafa" : "#18181b",
          colorInputBackground: resolvedTheme === "dark" ? "#27272a" : "#f4f4f5",
          colorInputText: resolvedTheme === "dark" ? "#fafafa" : "#18181b",
          colorDanger: "#ef4444",
          fontFamily: "Inter, system-ui, sans-serif",
          borderRadius: "0.5rem",
        },
        elements: {
          card: {
            backgroundColor: resolvedTheme === "dark" ? "#1a1e23" : "#ffffff",
          },
          /* UserButton popover: ensure correct bg for current theme */
          userButtonPopoverCard: {
            backgroundColor: resolvedTheme === "dark" ? "#1a1e23" : "#ffffff",
          },
          userButtonPopoverActionButton: {
            color: resolvedTheme === "dark" ? "#e5e7eb" : "#18181b",
          },
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
