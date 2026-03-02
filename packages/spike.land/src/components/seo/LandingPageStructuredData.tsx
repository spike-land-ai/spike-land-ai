import toolsManifest from "@/lib/docs/generated/tools-manifest.json";

export function LandingPageStructuredData() {
  const count = toolsManifest.tools.length;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://spike.land/#organization",
        name: "Spike Land",
        legalName: "SPIKE LAND LTD",
        url: "https://spike.land",
        logo: {
          "@type": "ImageObject",
          url: "https://spike.land/opengraph-image",
        },
        email: "hello@spike.land",
        sameAs: ["https://twitter.com/spikeland", "https://github.com/spike-land-ai/spike.land"],
        contactPoint: {
          "@type": "ContactPoint",
          email: "hello@spike.land",
          contactType: "customer support",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://spike.land/#platform",
        name: "Spike Land",
        url: "https://spike.land",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        provider: {
          "@id": "https://spike.land/#organization",
        },
        description: `Open-source MCP multiplexer platform. spike-cli lazy-loads tool definitions — agents see only the tools they need. ${count}+ tools across 15+ categories.`,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "GBP",
        },
      },
      {
        "@type": "WebSite",
        "@id": "https://spike.land/#website",
        name: "spike.land",
        url: "https://spike.land",
        publisher: { "@id": "https://spike.land/#organization" },
      },
      {
        "@type": "WebApplication",
        name: "Spike Land App Builder",
        url: "https://spike.land/create",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        provider: {
          "@id": "https://spike.land/#organization",
        },
        description:
          "AI-powered app builder that creates live, deployable web apps from natural language prompts.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "GBP",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
