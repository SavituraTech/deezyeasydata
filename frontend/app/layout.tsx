import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Deezy Easy Data — Stay connected, stay easy",
    template: "%s · Deezy Easy Data",
  },
  description:
    "Buy data and airtime, pay everyday bills, and fund your wallet securely with Deezy Easy Data.",
  keywords: [
    "Deezy Easy Data",
    "airtime",
    "data bundles",
    "bill payments",
    "wallet",
    "fintech",
    "electricity",
    "cable tv",
  ],
  authors: [{ name: "Deezy Easy Data" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    other: [
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Deezy Easy Data — Stay connected, stay easy",
    description:
      "Buy airtime and data, pay bills, and manage your money in one premium fintech experience.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F9F9F6" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1c1b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${ibmPlexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-right"
            theme="system"
            richColors
            duration={4000}
            swipeDirections={["right"]}
            visibleToasts={3}
            gap={12}
            toastOptions={{
              className: "group",
              style: {
                background: "var(--color-surface-elevated)",
                border: "1px solid var(--color-border)",
                color: "var(--foreground)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 16px",
                fontSize: "14px",
                boxShadow: "var(--shadow-lg)",
                maxWidth: "380px",
              },
            }}
            icons={{
              success: (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>
                </span>
              ),
              error: (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-error)]/10 text-[var(--color-error)]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>
                </span>
              ),
              warning: (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4v4M8 11h.01"/></svg>
                </span>
              ),
              info: (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-action)]/10 text-[var(--color-action)]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 8v.01"/></svg>
                </span>
              ),
              loading: (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--color-text-secondary)]">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/></svg>
                </span>
              ),
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
