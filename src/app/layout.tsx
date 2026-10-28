import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import { ThemeScript } from "@/components/theme/theme-script";
import { DEFAULT_THEME } from "@/lib/theme/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Updater",
    template: "%s · Updater",
  },
  description:
    "Keep an evidence-backed developer portfolio and role-specific resumes up to date.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The bootstrap script may change data-theme before hydration (D-008).
    <html lang="en" data-theme={DEFAULT_THEME} suppressHydrationWarning className="antialiased">
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
