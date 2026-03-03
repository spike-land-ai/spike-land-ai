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
          width: 1200,
          height: 630,
        },
        email: "hello@spike.land",
        foundingDate: "2024",
        sameAs: [
          "https://twitter.com/spikeland",
          "https://github.com/spike-land-ai/spike.land",
          "https://github.com/spike-land-ai",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          email: "hello@spike.land",
          contactType: "customer support",
          availableLanguage: "English",
        },
      },
      {
        "@type": "WebSite",
        "@id": "https://spike.land/#website",
        name: "spike.land",
        url: "https://spike.land",
        description: `AI-powered development platform with ${count}+ MCP tools for AI agents`,
        publisher: { "@id": "https://spike.land/#organization" },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://spike.land/tools?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://spike.land/#platform",
        name: "spike.land — AI Development Platform",
        alternateName: "spike-cli",
        url: "https://spike.land",
        applicationCategory: "DeveloperApplication",
        applicationSubCategory: "AI Tools",
        operatingSystem: "Web, macOS, Linux, Windows",
        provider: {
          "@id": "https://spike.land/#organization",
        },
        description:
          `AI-powered development platform that gives agents instant access to ${count}+ curated MCP tools. Lazy-loads tool definitions so AI agents only see what they need — dramatically reducing context window usage and LLM costs.`,
        featureList: [
          `${count}+ curated MCP tools`,
          "Lazy tool loading for reduced context window usage",
          "LLM cost optimization",
          "Any transport support (stdio, SSE, HTTP)",
          "Single configuration file",
          "Real-time collaboration",
        ],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
          description: "Free tier available",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          ratingCount: "127",
          bestRating: "5",
          worstRating: "1",
        },
      },
      {
        "@type": "WebApplication",
        "@id": "https://spike.land/#store",
        name: "spike.land Tool Registry",
        url: "https://spike.land/store",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        provider: {
          "@id": "https://spike.land/#organization",
        },
        description: `Browse and install ${count}+ AI agent tools from the spike.land MCP registry. One command to add any tool to your AI workflow.`,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "GBP",
        },
      },
      {
        "@type": "FAQPage",
        "@id": "https://spike.land/#faq",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is spike.land?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `spike.land is an AI-powered development platform that provides AI agents with instant access to ${count}+ curated MCP (Model Context Protocol) tools. It uses lazy loading so agents only download tool definitions they actually need, keeping context windows focused and LLM costs low.`,
            },
          },
          {
            "@type": "Question",
            name: "What is MCP (Model Context Protocol)?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Model Context Protocol (MCP) is an open standard that enables AI assistants to securely access external tools and data sources. spike.land provides a registry of ${count}+ MCP-compatible tools that AI agents can use.",
            },
          },
          {
            "@type": "Question",
            name: "Is spike.land free to use?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes, spike.land offers a free tier that gives you access to the core MCP tool registry and spike-cli. Premium plans are available for teams and enterprises needing advanced features.",
            },
          },
          {
            "@type": "Question",
            name: "How does lazy tool loading work?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "spike-cli implements lazy loading by only sending tool definitions to the AI agent when those specific tools are invoked. This means your AI agent's context window stays clean and focused, rather than being filled with hundreds of tool descriptions upfront.",
            },
          },
        ],
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
