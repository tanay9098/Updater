import type { Metadata } from "next";
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
        {/* The app shell lives in (workspace)/layout.tsx, so the sign-in page has none. */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
