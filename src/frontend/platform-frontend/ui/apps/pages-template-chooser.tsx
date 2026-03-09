import { startTransition, useDeferredValue, useMemo, useState } from "react";
import {
  Award,
  BookOpenText,
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  IdCard,
  LayoutTemplate,
  Mail,
  Megaphone,
  Newspaper,
  NotebookPen,
  PanelsTopLeft,
  PenTool,
  Search,
  Shapes,
  Sparkles,
  Star,
} from "lucide-react";
import { cn } from "../../styling/cn";
import { PAGES_TEMPLATE_SEEDS, type PagesTemplateSeed, type TemplateCategoryId } from "./pages-template-chooser-data";

type SidebarCategoryId = "all" | "premium" | TemplateCategoryId;

interface SidebarCategory {
  id: SidebarCategoryId;
  label: string;
  icon: typeof LayoutTemplate;
}

const SIDEBAR_CATEGORIES: SidebarCategory[] = [
  { id: "all", label: "All Templates", icon: LayoutTemplate },
  { id: "premium", label: "Premium", icon: Sparkles },
  { id: "basic", label: "Basic", icon: FileText },
  { id: "reports", label: "Reports", icon: NotebookPen },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "organisers", label: "Organisers", icon: PanelsTopLeft },
  { id: "newsletters", label: "Newsletters", icon: Newspaper },
  { id: "brochures", label: "Brochures", icon: LayoutTemplate },
  { id: "business", label: "Business", icon: BriefcaseBusiness },
  { id: "books", label: "Books", icon: BookOpenText },
  { id: "cards", label: "Cards", icon: Star },
  { id: "posters-flyers", label: "Posters & Flyers", icon: Megaphone },
  { id: "letters", label: "Letters", icon: Mail },
  { id: "curricula-vitae", label: "Curricula Vitae", icon: IdCard },
  { id: "stationery", label: "Stationery", icon: PenTool },
  { id: "miscellaneous", label: "Miscellaneous", icon: Shapes },
];

const SECTION_ORDER: TemplateCategoryId[] = [
  "basic",
  "reports",
  "education",
  "certificates",
  "organisers",
  "newsletters",
  "brochures",
  "business",
  "books",
  "cards",
  "posters-flyers",
  "letters",
  "curricula-vitae",
  "stationery",
  "miscellaneous",
];

const SECTION_LABELS: Record<TemplateCategoryId, string> = {
  basic: "Basic",
  reports: "Reports",
  education: "Education",
  certificates: "Certificates",
  organisers: "Organisers",
  newsletters: "Newsletters",
  brochures: "Brochures",
  business: "Business",
  books: "Books",
  cards: "Cards",
  "posters-flyers": "Posters & Flyers",
  letters: "Letters",
  "curricula-vitae": "Curricula Vitae",
  stationery: "Stationery",
  miscellaneous: "Miscellaneous",
};

function inferTone(template: PagesTemplateSeed): {
  page: string;
  ink: string;
  frame: string;
  accent: string;
  chip: string;
} {
  const haystack = template.name.toLowerCase();

  if (haystack.includes("cyber") || haystack.includes("dark") || haystack.includes("code")) {
    return {
      page: "linear-gradient(135deg, #08121d 0%, #10263a 100%)",
      ink: "#d9fff2",
      frame: "rgba(73, 255, 195, 0.34)",
      accent: "#3ce5a3",
      chip: "rgba(73, 255, 195, 0.16)",
    };
  }

  if (haystack.includes("scientific") || haystack.includes("industrial") || haystack.includes("university")) {
    return {
      page: "linear-gradient(135deg, #dce6ee 0%, #f6f8fb 100%)",
      ink: "#24384c",
      frame: "rgba(87, 112, 138, 0.26)",
      accent: "#6a8cab",
      chip: "rgba(106, 140, 171, 0.18)",
    };
  }

  if (haystack.includes("wedding") || haystack.includes("luxury") || haystack.includes("meadow") || haystack.includes("cream")) {
    return {
      page: "linear-gradient(135deg, #f3efe4 0%, #dfe6d4 100%)",
      ink: "#33402e",
      frame: "rgba(96, 126, 98, 0.22)",
      accent: "#8fa37f",
      chip: "rgba(143, 163, 127, 0.18)",
    };
  }

  if (haystack.includes("sales") || haystack.includes("bold") || haystack.includes("gradient") || haystack.includes("recreation")) {
    return {
      page: "linear-gradient(135deg, #fff0bf 0%, #ffe070 42%, #ffb347 100%)",
      ink: "#5f2801",
      frame: "rgba(255, 122, 61, 0.26)",
      accent: "#f36b2a",
      chip: "rgba(243, 107, 42, 0.2)",
    };
  }

  if (haystack.includes("educator") || haystack.includes("school") || haystack.includes("note taking") || haystack.includes("family")) {
    return {
      page: "linear-gradient(135deg, #f5eefc 0%, #fef6d9 100%)",
      ink: "#503f68",
      frame: "rgba(164, 118, 215, 0.25)",
      accent: "#a478d7",
      chip: "rgba(164, 118, 215, 0.18)",
    };
  }

  if (haystack.includes("certificate") || haystack.includes("achievement") || haystack.includes("golden")) {
    return {
      page: "linear-gradient(135deg, #fff9e7 0%, #f2e2b6 100%)",
      ink: "#55401c",
      frame: "rgba(177, 137, 54, 0.24)",
      accent: "#b18936",
      chip: "rgba(177, 137, 54, 0.18)",
    };
  }

  if (haystack.includes("travel") || haystack.includes("community") || haystack.includes("volunteer") || haystack.includes("museum")) {
    return {
      page: "linear-gradient(135deg, #d8f0f4 0%, #f6f5ea 100%)",
      ink: "#264651",
      frame: "rgba(67, 135, 153, 0.24)",
      accent: "#438799",
      chip: "rgba(67, 135, 153, 0.18)",
    };
  }

  return {
    page: "linear-gradient(135deg, #ffffff 0%, #f1f2f7 100%)",
    ink: "#2b3240",
    frame: "rgba(97, 109, 128, 0.2)",
    accent: "#e47d2f",
    chip: "rgba(228, 125, 47, 0.14)",
  };
}

function matchesSearch(template: PagesTemplateSeed, query: string): boolean {
  if (!query) return true;
  const haystack = [template.name, ...template.categories, template.premium ? "premium" : "free"]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function TemplatePreview({ template, selected }: { template: PagesTemplateSeed; selected: boolean }) {
  const tone = inferTone(template);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
        selected ? "border-[#e47d2f]" : "border-black/5",
      )}
      style={{ background: tone.page }}
    >
      {template.premium && (
        <div
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-[10px] border border-white/25 bg-black/70 text-[#b887ff]"
          title="Premium template"
        >
          <Star className="h-3.5 w-3.5 fill-current" />
        </div>
      )}

      <div
        className="mx-auto min-h-[176px] rounded-[18px] border bg-white/78 p-3"
        style={{ borderColor: tone.frame, color: tone.ink }}
      >
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-10 rounded-full" style={{ backgroundColor: tone.accent }} />
          <div className="h-2.5 w-16 rounded-full bg-black/8" />
        </div>

        <div className="mt-3 grid grid-cols-[1.15fr_0.85fr] gap-3">
          <div className="space-y-2">
            <div className="h-16 rounded-[14px]" style={{ backgroundColor: tone.chip }} />
            <div className="h-2.5 w-full rounded-full bg-black/10" />
            <div className="h-2.5 w-5/6 rounded-full bg-black/10" />
            <div className="h-2.5 w-4/6 rounded-full bg-black/10" />
          </div>
          <div className="space-y-2">
            <div className="h-8 rounded-[12px]" style={{ backgroundColor: tone.chip }} />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-14 rounded-[12px] bg-black/6" />
              <div className="h-14 rounded-[12px] bg-black/6" />
            </div>
            <div className="h-8 rounded-[12px] bg-black/6" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PagesTemplateChooserApp() {
  const [activeCategory, setActiveCategory] = useState<SidebarCategoryId>("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const visibleTemplates = useMemo(() => {
    return PAGES_TEMPLATE_SEEDS.filter((template) => {
      if (activeCategory === "premium" && !template.premium) return false;
      if (activeCategory !== "all" && activeCategory !== "premium" && !template.categories.includes(activeCategory)) {
        return false;
      }
      return matchesSearch(template, deferredSearch);
    });
  }, [activeCategory, deferredSearch]);

  const groupedSections = useMemo(() => {
    if (activeCategory !== "all") return [];

    return SECTION_ORDER.map((categoryId) => ({
      id: categoryId,
      label: SECTION_LABELS[categoryId],
      templates: visibleTemplates.filter((template) => template.categories.includes(categoryId)),
    })).filter((section) => section.templates.length > 0);
  }, [activeCategory, visibleTemplates]);

  const selectedTemplate =
    PAGES_TEMPLATE_SEEDS.find((template) => template.id === selectedTemplateId) ?? null;

  const currentLabel =
    SIDEBAR_CATEGORIES.find((category) => category.id === activeCategory)?.label ?? "Choose a Template";

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(255,210,160,0.24),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(87,131,255,0.16),_transparent_28%),linear-gradient(180deg,_#f3f4f8_0%,_#e9ecf4_100%)] p-4 sm:p-6">
      <div className="mx-auto max-w-[1180px] rounded-[34px] border border-white/65 bg-[#f6f5f8]/95 shadow-[0_40px_120px_rgba(31,39,63,0.22)] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full bg-[#ff5f57]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#febc2e]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#28c840]" />
            <div className="ml-4 rounded-full bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4b5563]">
              Pages Template Chooser
            </div>
          </div>
          <div className="hidden rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-[#4b5563] shadow-sm md:block">
            {selectedTemplate ? `Selected: ${selectedTemplate.name}` : "Select a template to create a document"}
          </div>
        </div>

        <div className="grid min-h-[780px] lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-black/5 bg-white/52 p-4 backdrop-blur-xl lg:border-b-0 lg:border-r">
            <div className="mb-3 px-2">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#7b8494]">
                Template Library
              </p>
              <p className="mt-2 text-sm leading-6 text-[#5d6473]">
                Choose a category first, then select a template to create in Pages.
              </p>
            </div>

            <div className="space-y-1 overflow-y-auto pr-1">
              {SIDEBAR_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      startTransition(() => {
                        setActiveCategory(category.id);
                      })
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all",
                      isActive
                        ? "bg-[#ececf1] text-[#1f2937] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]"
                        : "text-[#5d6473] hover:bg-white/70 hover:text-[#1f2937]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-2xl",
                        isActive ? "bg-white text-[#e47d2f]" : "bg-black/5 text-[#7b8494]",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={cn("text-sm", isActive && "font-bold")}>{category.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-[#faf9fb]">
            <div className="border-b border-black/5 px-6 py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#8a90a0]">
                    Choose a Template
                  </p>
                  <h2 className="mt-2 text-4xl font-black tracking-tight text-[#171d29]">
                    {currentLabel}
                  </h2>
                  <p className="mt-2 max-w-3xl text-base leading-7 text-[#5d6473]">
                    Browse a native-feeling Pages gallery with dense categories, premium badges,
                    and a clear creation path.
                  </p>
                </div>

                <label className="flex w-full items-center gap-3 rounded-2xl border border-black/6 bg-white px-4 py-3 shadow-sm lg:max-w-sm">
                  <Search className="h-4 w-4 text-[#7b8494]" />
                  <input
                    value={search}
                    onChange={(event) =>
                      startTransition(() => {
                        setSearch(event.target.value);
                      })
                    }
                    placeholder="Search templates"
                    className="w-full bg-transparent text-sm text-[#1f2937] outline-none placeholder:text-[#9ca3af]"
                  />
                </label>
              </div>

              {activeCategory === "all" && (
                <div className="mt-6 overflow-hidden rounded-[28px] border border-[#efb169] bg-[linear-gradient(135deg,_#ffb052_0%,_#ff8e3c_48%,_#ff6f61_100%)] text-white shadow-[0_24px_80px_rgba(255,140,76,0.28)]">
                  <div className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">
                        Included with Apple Creator Studio
                      </p>
                      <h3 className="mt-3 text-3xl font-black tracking-tight">Elevate Your Documents</h3>
                      <p className="mt-3 max-w-xl text-sm leading-7 text-white/86">
                        Premium proposals, lesson plans, reports, and certificates designed to feel
                        first-party from day one.
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-white/20 bg-white/12 p-5 backdrop-blur-md">
                      <div className="grid grid-cols-3 gap-3">
                        {visibleTemplates
                          .filter((template) => template.premium)
                          .slice(0, 3)
                          .map((template) => (
                            <div key={template.id} className="rounded-[18px] border border-white/16 bg-white/10 p-3">
                              <div className="h-20 rounded-[14px] bg-white/18" />
                              <p className="mt-2 text-xs font-semibold leading-5 text-white/88">
                                {template.name}
                              </p>
                            </div>
                          ))}
                      </div>
                      <button className="mt-4 text-sm font-semibold text-white underline underline-offset-4">
                        Accept 3 Months Free &gt;
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {activeCategory === "all" ? (
                <div className="space-y-10">
                  {groupedSections.map((section) => (
                    <section key={section.id} className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-2xl font-black tracking-tight text-[#171d29]">
                            {section.label}
                          </h3>
                          <p className="mt-1 text-sm text-[#6b7280]">
                            {section.templates.length} template{section.templates.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {section.templates.map((template) => {
                          const isSelected = selectedTemplateId === template.id;
                          return (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => setSelectedTemplateId(template.id)}
                              className={cn(
                                "overflow-hidden rounded-[28px] border bg-white p-3 text-left shadow-[0_16px_48px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:border-[#e47d2f]/40",
                                isSelected ? "border-[#e47d2f] shadow-[0_20px_56px_rgba(228,125,47,0.24)]" : "border-black/6",
                              )}
                            >
                              <TemplatePreview template={template} selected={isSelected} />
                              <div
                                className={cn(
                                  "mt-3 rounded-[20px] px-4 py-3",
                                  isSelected ? "bg-[#e47d2f] text-white" : "bg-[#f6f5f8] text-[#202939]",
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-bold leading-5">{template.name}</p>
                                  {template.premium && (
                                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]", isSelected ? "bg-white/20 text-white" : "bg-[#1f2937] text-[#caa8ff]")}>
                                      premium
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : visibleTemplates.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleTemplates.map((template) => {
                    const isSelected = selectedTemplateId === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={cn(
                          "overflow-hidden rounded-[28px] border bg-white p-3 text-left shadow-[0_16px_48px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:border-[#e47d2f]/40",
                          isSelected ? "border-[#e47d2f] shadow-[0_20px_56px_rgba(228,125,47,0.24)]" : "border-black/6",
                        )}
                      >
                        <TemplatePreview template={template} selected={isSelected} />
                        <div
                          className={cn(
                            "mt-3 rounded-[20px] px-4 py-3",
                            isSelected ? "bg-[#e47d2f] text-white" : "bg-[#f6f5f8] text-[#202939]",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-bold leading-5">{template.name}</p>
                            {template.premium && (
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]", isSelected ? "bg-white/20 text-white" : "bg-[#1f2937] text-[#caa8ff]")}>
                                premium
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 p-10 text-center text-[#6b7280]">
                  No templates match this category yet. Add a new family and it will appear here.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-black/5 px-6 py-5">
              <button className="rounded-2xl border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[#253041] shadow-sm transition hover:bg-[#f5f5f8]">
                Cancel
              </button>

              <div className="flex items-center gap-4">
                <div className="hidden text-right md:block">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9aa0ae]">
                    Selected Template
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#171d29]">
                    {selectedTemplate?.name ?? "Choose one to continue"}
                  </p>
                </div>
                <button
                  disabled={!selectedTemplate}
                  className={cn(
                    "rounded-2xl px-8 py-3 text-sm font-bold text-white shadow-[0_18px_42px_rgba(62,104,233,0.25)] transition",
                    selectedTemplate
                      ? "bg-[#3568e9] hover:bg-[#2f5fd7]"
                      : "cursor-not-allowed bg-[#c7cfdf] shadow-none",
                  )}
                >
                  Create
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
