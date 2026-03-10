import { Link, useParams } from "@tanstack/react-router";
import { isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { apiUrl } from "../../../core-logic/api";
import { sanitizeUrl } from "../../../core-logic/lib/security";
import { CodeBlock } from "../../../../../core/block-website/ui/CodeBlock";

const SITE_URL = "https://spike.land";
const GITHUB_BLOB_BASE = "https://github.com/spike-land-ai/spike-land-ai/blob/main/";
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/spike-land-ai/spike-land-ai/main/";

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
  sourcePath: string;
}

function resolveAgainstRepoBase(target: string, sourcePath: string, baseUrl: string) {
  try {
    return new URL(target, `${baseUrl}${sourcePath}`).toString();
  } catch {
    return target;
  }
}

function resolveDocHref(href: string | undefined, sourcePath: string) {
  if (!href) return "about:blank";

  const trimmedHref = href.trim();

  if (trimmedHref.startsWith("#")) {
    return trimmedHref;
  }

  if (/^(https?|mailto|tel):/i.test(trimmedHref) || trimmedHref.startsWith("/")) {
    return sanitizeUrl(trimmedHref);
  }

  return sanitizeUrl(resolveAgainstRepoBase(trimmedHref, sourcePath, GITHUB_BLOB_BASE));
}

function resolveDocAssetSrc(src: string | undefined, sourcePath: string) {
  if (!src) return "about:blank";

  const trimmedSrc = src.trim();

  if (/^https?:/i.test(trimmedSrc) || trimmedSrc.startsWith("/")) {
    return sanitizeUrl(trimmedSrc);
  }

  return sanitizeUrl(resolveAgainstRepoBase(trimmedSrc, sourcePath, GITHUB_RAW_BASE));
}

function getNodeText(node: ReactNode): string {
  if (Array.isArray(node)) {
    return node.map((item) => getNodeText(item)).join("");
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (isValidElement(node)) {
    return getNodeText(node.props.children);
  }

  return "";
}

function slugifyHeading(children: ReactNode) {
  return getNodeText(children)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function DocPage() {
  const { slug } = useParams({ from: "/docs/$slug" });
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(apiUrl(`/docs/${slug}`))
      .then((res) => {
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

  const renderedContent = useMemo(() => {
    if (!doc) return null;

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => {
            const id = slugifyHeading(children);
            return (
              <h1
                id={id || undefined}
                className="scroll-mt-24 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                {children}
              </h1>
            );
          },
          h2: ({ children }) => {
            const id = slugifyHeading(children);
            return (
              <h2
                id={id || undefined}
                className="mt-10 scroll-mt-24 text-2xl font-semibold tracking-tight text-foreground"
              >
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = slugifyHeading(children);
            return (
              <h3
                id={id || undefined}
                className="mt-8 scroll-mt-24 text-xl font-semibold text-foreground"
              >
                {children}
              </h3>
            );
          },
          h4: ({ children }) => {
            const id = slugifyHeading(children);
            return (
              <h4
                id={id || undefined}
                className="mt-6 scroll-mt-24 text-lg font-semibold text-foreground"
              >
                {children}
              </h4>
            );
          },
          p: ({ children }) => (
            <p className="text-[0.98rem] leading-8 text-foreground/90">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-2 pl-6 text-[0.98rem] leading-8 text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-2 pl-6 text-[0.98rem] leading-8 text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          hr: () => <hr className="my-10 border-border" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => {
            const resolvedHref = resolveDocHref(href, doc.sourcePath);
            const isExternal =
              /^(https?:|mailto:|tel:)/i.test(resolvedHref) && !resolvedHref.startsWith(SITE_URL);

            return (
              <a
                href={resolvedHref}
                className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => (
            <img
              src={resolveDocAssetSrc(src, doc.sourcePath)}
              alt={alt || ""}
              className="my-6 rounded-xl border border-border"
              loading="lazy"
            />
          ),
          pre: ({ children }: { children?: React.ReactNode }) => children,
          code: CodeBlock as React.ComponentType<Record<string, unknown>>,
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-border/70">{children}</tbody>,
          tr: ({ children }) => <tr className="align-top">{children}</tr>,
          th: ({ children }) => (
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-4 py-3 text-foreground/90">{children}</td>,
          details: ({ children }) => (
            <details className="rounded-2xl border border-border bg-card/70 px-4 py-3">
              {children}
            </details>
          ),
          summary: ({ children }) => (
            <summary className="cursor-pointer font-medium text-foreground">{children}</summary>
          ),
        }}
      >
        {doc.content}
      </ReactMarkdown>
    );
  }, [doc]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <h1 className="text-2xl font-bold text-foreground">Document not found</h1>
        <p className="text-muted-foreground">
          The requested documentation page could not be found.
        </p>
        <Link to="/docs" className="text-primary underline hover:text-primary/80">
          Back to Documentation
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <nav
        className="flex items-center gap-2 text-sm text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <Link to="/docs" className="transition-colors hover:text-foreground">
          Docs
        </Link>
        <span aria-hidden="true">/</span>
        <span>{doc.category}</span>
        <span aria-hidden="true">/</span>
        <span className="text-foreground">{doc.title}</span>
      </nav>

      <article className="space-y-5 [&_.shiki-container]:bg-muted/50 [&_.shiki-container]:border [&_.shiki-container]:border-border [&_.shiki-container]:rounded-2xl [&_.shiki-container]:px-4 [&_.shiki-container]:py-4 [&_.shiki-container]:overflow-x-auto [&_.shiki-container]:my-4 [&_.shiki-container]:pt-10 [&_.shiki-container_code]:bg-transparent [&_.shiki-container_code]:p-0 [&_.shiki-container_code]:text-sm [&_.shiki-container_code]:border-0 [&_.shiki-container_.shiki]:!bg-transparent">
        {renderedContent}
      </article>

      <div className="border-t border-border pt-8">
        <Link
          to="/docs"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span aria-hidden="true">&larr;</span> Back to Documentation
        </Link>
      </div>
    </div>
  );
}
