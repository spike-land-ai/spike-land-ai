"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";
import { Check, Copy, Facebook, Heart, Linkedin, Megaphone, Rocket, Share2 } from "lucide-react";

interface BlogSupportProps {
  articleSlug: string;
  articleTitle: string;
}

const SHARE_PLATFORMS = [
  {
    name: "X / Twitter",
    icon: Share2,
    getUrl: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(
        title,
      )}`,
  },
  {
    name: "LinkedIn",
    icon: Linkedin,
    getUrl: (url: string, title: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(
        title,
      )}`,
  },
  {
    name: "Facebook",
    icon: Facebook,
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

const DONATION_AMOUNTS = [5, 10, 25] as const;
const SUBSCRIPTION_AMOUNTS = [3, 5, 10] as const;
const PROMOTION_AMOUNTS = [5, 10, 25] as const;

async function createCheckout(
  mode: "donation" | "subscription" | "promote",
  amount: number,
  articleSlug: string,
) {
  const res = await fetch("/api/stripe/blog-support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, amount, articleSlug }),
  });
  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  }
}

export function BlogSupport({ articleSlug, articleTitle }: BlogSupportProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const articleUrl = `https://spike.land/blog/${articleSlug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(articleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckout = async (mode: "donation" | "subscription" | "promote", amount: number) => {
    const key = `${mode}-${amount}`;
    setLoading(key);
    try {
      await createCheckout(mode, amount, articleSlug);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-16 pt-8 border-t border-white/8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: Promote This Article */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="h-5 w-5 text-cyan-400" />
            <h3 className="font-heading text-lg font-bold">Promote This Article</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            If you liked this article, the easiest way to help is to share it.
          </p>

          {/* Share buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {SHARE_PLATFORMS.map((platform) => (
              <Button key={platform.name} variant="outline" size="sm" asChild>
                <a
                  href={platform.getUrl(articleUrl, articleTitle)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <platform.icon className="h-4 w-4 mr-1.5" />
                  {platform.name}
                </a>
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copy link
                </>
              )}
            </Button>
          </div>

          {/* Paid promotion */}
          <div className="border-t border-white/6 pt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Boost this article — your contribution goes directly to reaching more people via
              targeted promotion.
            </p>
            <div className="flex flex-wrap gap-2">
              {PROMOTION_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  disabled={loading !== null}
                  onClick={() => handleCheckout("promote", amount)}
                >
                  {loading === `promote-${amount}` ? "..." : `£${amount}`}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Column 2: Support the Author */}
        <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="h-5 w-5 text-pink-400" />
            <h3 className="font-heading text-lg font-bold">Support the Author</h3>
          </div>

          {/* One-off support */}
          <p className="text-sm text-muted-foreground mb-3">One-off support</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {DONATION_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                disabled={loading !== null}
                onClick={() => handleCheckout("donation", amount)}
              >
                {loading === `donation-${amount}` ? "..." : `£${amount}`}
              </Button>
            ))}
          </div>

          {/* Monthly support */}
          <div className="border-t border-border/50 pt-4 mb-6">
            <p className="text-sm text-muted-foreground mb-3">Monthly support</p>
            <div className="flex flex-wrap gap-2">
              {SUBSCRIPTION_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  disabled={loading !== null}
                  onClick={() => handleCheckout("subscription", amount)}
                >
                  {loading === `subscription-${amount}` ? "..." : `£${amount}/mo`}
                </Button>
              ))}
            </div>
          </div>

          {/* spike.land CTA */}
          <div className="border-t border-white/6 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium">Try spike.land for free</span>
              <Badge variant="secondary" className="text-xs">
                Free tier
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              AI dev tools, code editor, 455+ MCP tools — build and deploy apps with AI.
            </p>
            <div className="flex gap-2">
              <Button asChild size="sm" className="shadow-glow-cyan">
                <Link href="/store">App Store</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/">spike.land</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
