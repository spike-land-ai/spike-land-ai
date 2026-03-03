import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import toolsManifest from "@/lib/docs/generated/tools-manifest.json";
import "./globals.css";
import { SessionProvider } from "@/components/auth/session-provider";
import { AuthDialogProvider } from "@/components/auth/AuthDialogProvider";
import { AuthDialogAutoOpen } from "@/components/auth/AuthDialogAutoOpen";
import { CookieConsent } from "@/components/CookieConsent";
import { Footer } from "@/components/footer/Footer";
import { SiteNav } from "@/components/navigation/SiteNav";
import { SiteChatLazy as SiteChat } from "@/components/chat/SiteChatLazy";
import { CommandPalette } from "@/components/docs/CommandPalette";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AnimationPerformanceProvider } from "@/components/providers/AnimationPerformanceProvider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { GoogleAnalytics } from "@/components/tracking/GoogleAnalytics";
import { SessionTracker } from "@/components/tracking/SessionTracker";
import { Toaster } from "@/components/ui/sonner";
import { getNonce } from "@/lib/security/csp-nonce-server";
import { ViewTransitions } from "next-view-transitions";

// Browser-only error capture utilities — skip SSR entirely to reduce server bundle
const ConsoleCapture = dynamic(
  () => import("@/components/errors/ConsoleCapture").then((m) => ({ default: m.ConsoleCapture })),
  { ssr: false },
);

const IframeErrorBridge = dynamic(
  () =>
    import("@/components/errors/IframeErrorBridge").then((m) => ({
      default: m.IframeErrorBridge,
    })),
  { ssr: false },
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
  weight: ["600", "700"],
});

const MCP_COUNT = toolsManifest.tools.length;

export const metadata: Metadata = {
  metadataBase: new URL("https://spike.land"),
  title: {
    default: `spike.land — AI-Powered Development Platform with ${MCP_COUNT}+ MCP Tools`,
    template: `%s | spike.land`,
  },
  description:
    `spike.land gives AI agents instant access to ${MCP_COUNT}+ curated MCP tools with lazy loading — agents only load what they need, slashing context window usage and LLM costs. One config, any transport.`,
  keywords: [
    "spike.land",
    "AI development platform",
    "MCP multiplexer",
    "Model Context Protocol",
    "lazy loading MCP tools",
    "AI agent tools",
    "spike-cli",
    "LLM cost reduction",
    "context window optimization",
    "MCP tools registry",
    "developer tools for AI",
    "AI-powered development",
    "MCP server",
    "Claude tools",
    "AI productivity",
  ],
  authors: [{ name: "Zoltan Erdos", url: "https://spike.land" }],
  creator: "Zoltan Erdos",
  publisher: "SPIKE LAND LTD",
  category: "technology",
  classification: "Developer Tools",
  openGraph: {
    title: `spike.land — AI-Powered Development Platform with ${MCP_COUNT}+ MCP Tools`,
    description:
      `Give your AI agents instant access to ${MCP_COUNT}+ curated tools. spike.land lazy-loads MCP tool definitions so agents only see what they need — focused context, lower costs.`,
    type: "website",
    siteName: "spike.land",
    url: "https://spike.land",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `spike.land — AI Development Platform with ${MCP_COUNT}+ MCP Tools`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@spikeland",
    creator: "@spikeland",
    title: `spike.land — AI Dev Platform with ${MCP_COUNT}+ MCP Tools`,
    description:
      `Give your AI agents instant access to ${MCP_COUNT}+ curated tools. Lazy-load MCP definitions — focused context, lower LLM costs.`,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://spike.land",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0b0e14",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = await getNonce();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          nonce={nonce ?? undefined}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || localStorage.getItem('selected-theme');
                  if (theme) {
                    if (theme === 'dark') document.documentElement.classList.add('dark');
                    else if (theme === 'light') document.documentElement.classList.add('light');
                    else document.documentElement.classList.add(theme);
                  } else {
                    document.documentElement.classList.add('dark'); // default
                  }
                } catch { /* Expected: localStorage throws in Safari Private Browsing */ }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} antialiased`}
        suppressHydrationWarning
      >
        <ViewTransitions>
          <ThemeProvider
            themes={["light", "dark", "theme-soft-light", "theme-deep-dark"]}
            defaultTheme="dark"
            disableTransitionOnChange
            {...(nonce ? { nonce } : {})}
          >
            <QueryProvider>
              <AnimationPerformanceProvider>
                <SessionProvider>
                  <AuthDialogProvider>
                    <a
                      href="#main-content"
                      className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-background focus:text-foreground"
                    >
                      Skip to content
                    </a>
                    <SiteNav />
                    <main id="main-content">
                      {children}
                    </main>
                    <Footer />
                    <SiteChat />
                    <CommandPalette />
                    <Suspense fallback={null}>
                      <AuthDialogAutoOpen />
                      <SessionTracker />
                    </Suspense>
                  </AuthDialogProvider>
                </SessionProvider>
              </AnimationPerformanceProvider>
            </QueryProvider>
            <Toaster toastOptions={{ className: "z-[100]" }} />
            <CookieConsent />
          </ThemeProvider>
        </ViewTransitions>
        <ConsoleCapture />
        <IframeErrorBridge />
        <GoogleAnalytics {...(nonce ? { nonce } : {})} />
      </body>
    </html>
  );
}
