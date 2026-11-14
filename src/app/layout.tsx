import type { Metadata, Viewport } from "next";
import "@fontsource-variable/funnel-display/wght.css";
import "@fontsource-variable/funnel-sans/wght.css";
import "@fontsource-variable/newsreader/wght.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Askwell: support answers that show their source", template: "%s | Askwell" },
  description:
    "A support assistant for your website. It answers from your own documents, shows the passage it used, and says so when it does not know.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f5f6f8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
