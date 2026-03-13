import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation("errors");

  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (existing) {
      existing.content = "noindex";
    } else {
      const meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex";
      document.head.appendChild(meta);
    }
    return () => {
      const el = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (el) el.content = "index, follow";
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-32 text-center">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4">
        {t("notFound.code")}
      </p>
      <h1 className="text-5xl sm:text-7xl font-black text-foreground tracking-tighter leading-[0.9] mb-6">
        {t("notFound.title")}
      </h1>
      <p className="text-lg text-muted-foreground font-medium max-w-md mb-12 leading-relaxed">
        {t("notFound.message")}
      </p>
      <nav className="flex flex-wrap items-center justify-center gap-3" aria-label="Helpful links">
        <Link
          to="/"
          className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
        >
          {t("notFound.home")}
        </Link>
        <Link
          to="/apps"
          className="rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground hover:border-primary/30 transition-colors"
        >
          {t("notFound.apps")}
        </Link>
        <Link
          to="/blog"
          className="rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground hover:border-primary/30 transition-colors"
        >
          {t("notFound.blog")}
        </Link>
        <Link
          to="/learnit"
          className="rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground hover:border-primary/30 transition-colors"
        >
          LearnIt
        </Link>
        <Link
          to="/chess"
          className="rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground hover:border-primary/30 transition-colors"
        >
          Chess
        </Link>
        <Link
          to="/store"
          className="rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground hover:border-primary/30 transition-colors"
        >
          {t("notFound.store")}
        </Link>
      </nav>
    </div>
  );
}
