import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { resolveSupportedLanguage, supportedLanguages } from "../i18n";

const FLAG_EMOJI: Record<string, string> = {
  GB: "\u{1F1EC}\u{1F1E7}",
  HU: "\u{1F1ED}\u{1F1FA}",
};

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLanguage = resolveSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);
  const current =
    supportedLanguages.find((l) => l.code === currentLanguage) ?? supportedLanguages[0];

  const handleSelect = useCallback(
    (code: string) => {
      void i18n.changeLanguage(code);
      setOpen(false);
    },
    [i18n],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-[0.78rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t("common:language")}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span aria-hidden="true">{FLAG_EMOJI[current.flag]}</span>
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t("common:language")}
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[140px] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          {supportedLanguages.map((lang) => (
            <li key={lang.code} role="option" aria-selected={lang.code === current.code}>
              <button
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[0.82rem] font-medium transition-colors ${
                  lang.code === current.code
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
              >
                <span aria-hidden="true">{FLAG_EMOJI[lang.flag]}</span>
                {lang.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
