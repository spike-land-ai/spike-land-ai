import { Link, useParams } from "@tanstack/react-router";
import { apiUrl } from "../../../core-logic/api";
import { useEffect, useState } from "react";
import { sanitizeUrl, escapeHtml } from "../../../core-logic/lib/security";

const SITE_URL = "https://spike.land";

function injectJsonLd(id: string, content: string) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = content;
}

interface DocDetail {
  slug: string;
  title: string;
  category: string;
  description: string;
  content: string;
}

export function DocPage() {
  const { slug } = useParams({ from: "/docs/$slug" });
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(apiUrl(`/docs/${slug}`))
      .then(res => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data: DocDetail) => {
        setDoc(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (!doc) return;
    injectJsonLd(
      "jsonld-breadcrumbs",
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Docs", item: `${SITE_URL}/docs` },
          { "@type": "ListItem", position: 3, name: doc.title, item: `${SITE_URL}/docs/${slug}` },
        ],
      }),
    );
  }, [doc, slug]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Document not found</h1>
        <p className="text-muted-foreground">The requested documentation page could not be found.</p>
        <Link to="/docs" className="text-primary underline hover:text-primary/80">Back to Documentation</Link>
      </div>
    );
  }

  // Simple markdown-to-HTML conversion for headings and paragraphs
  const renderContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("# ")) return <h1 key={i} className="text-3xl font-bold text-foreground mb-4">{line.slice(2)}</h1>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-2xl font-semibold text-foreground mt-8 mb-3">{line.slice(3)}</h2>;
      if (line.startsWith("### ")) return <h3 key={i} className="text-xl font-semibold text-foreground mt-6 mb-2">{line.slice(4)}</h3>;
      if (line.startsWith("---")) return <hr key={i} className="my-8 border-border" />;
      if (line.trim() === "") return <br key={i} />;
      // Handle links in markdown [text](url)
      const withLinks = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
        const safeUrl = sanitizeUrl(url);
        const safeText = escapeHtml(text);
        return `<a href="${safeUrl}" class="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
      });
      return <p key={i} className="text-foreground leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: withLinks }} />;
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/docs" className="hover:text-foreground transition-colors">Docs</Link>
        <span aria-hidden="true">/</span>
        <span>{doc.category}</span>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{doc.title}</span>
      </nav>

      {/* Content */}
      <article className="prose-like space-y-0">
        {renderContent(doc.content)}
      </article>

      {/* Back link */}
      <div className="pt-8 border-t border-border">
        <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          <span aria-hidden="true">&larr;</span> Back to Documentation
        </Link>
      </div>
    </div>
  );
}
