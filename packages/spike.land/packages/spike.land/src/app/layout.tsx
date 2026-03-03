import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import { Suspense } from "react";
import toolsManifest from "@/lib/docs/generated/tools-manifest.json";
import "./globals.css";
import { SessionProvider } from "@/components/auth/session-provider";
import { AuthDialogProvider } from "@/components/auth/AuthDialogProvider";
import { AuthDialogAutoOpen } from "@/components/auth/AuthDialogAutoOpen";
import { CookieConsent } from "@/components/CookieConsent";
import { ConsoleCapture } from "@/components/errors/ConsoleCapture";
import { IframeErrorBridge } from "@/components/errors/IframeErrorBridge";

import { Footer } from "@/components/footer/Footer";
import { SiteNav } from "@/components/navigation/SiteNav";
import { SiteChatLazy as SiteChat } from "@/components/chat/SiteChatLazy";
import { CommandPalette } from "@/components/docs/CommandPalette";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AnimationPerformanceProvider } from "@/components/providers/AnimationPerformanceProvider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { GoogleAnalytics } from "@/components/tracking/GoogleAnalytics";
import { MetaPixel } from "@/components/tracking/MetaPixel";
import { SessionTracker } from "@/components/tracking/SessionTracker";
import { Toaster } from "@/components/ui/sonner";
import { getNonce } from "@/lib/security/csp-nonce-server";
import { ViewTransitions } from "next-view-transitions";

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
  title: `spike.land — MCP Multiplexer with Lazy Tool Loading. ${MCP_COUNT}+ Tools.`,
  description:
    `spike-cli lazy-loads MCP tool definitions — AI agents only see what they need, keeping context windows focused and LLM costs low. ${MCP_COUNT}+ tools, one config, any transport.`,
  keywords: [
    "spike.land",
    "MCP multiplexer",
    "lazy loading MCP tools",
    "MCP toolset",
    "context window savings",
    "LLM cost reduction",
    "Model Context Protocol",
    "spike-cli",
    "MCP tools",
    "developer tools",
  ],
  authors: [{ name: "Zoltan Erdos" }],
  openGraph: {
    title: `spike.land — MCP Multiplexer with Lazy Tool Loading. ${MCP_COUNT}+ Tools.`,
    description:
      `spike-cli lazy-loads MCP tool definitions — AI agents only see what they need, keeping context windows focused and LLM costs low. ${MCP_COUNT}+ tools, one config, any transport.`,
    type: "website",
    siteName: "spike.land",
  },
  twitter: {
    card: "summary_large_image",
    title: `spike.land — MCP Multiplexer with Lazy Tool Loading. ${MCP_COUNT}+ Tools.`,
    description:
      `spike-cli lazy-loads MCP tool definitions — AI agents only see what they need, keeping context windows focused and LLM costs low. ${MCP_COUNT}+ tools, one config, any transport.`,
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
        <MetaPixel {...(nonce ? { nonce } : {})} />
        <GoogleAnalytics {...(nonce ? { nonce } : {})} />
      </body>
    </html>
  );
}
