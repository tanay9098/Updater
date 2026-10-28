import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Updater",
  description:
    "Keep an evidence-backed developer portfolio and role-specific resumes up to date.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
