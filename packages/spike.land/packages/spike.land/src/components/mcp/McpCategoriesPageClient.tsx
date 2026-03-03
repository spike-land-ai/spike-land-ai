"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type React from "react";

import { ICON_MAP } from "@/components/mcp/mcp-icon-map";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";

import { McpResponseViewer } from "./McpResponseViewer";
import { McpToolForm } from "./McpToolForm";
import {
  getToolsByCategory,
  MCP_SUPER_CATEGORIES,
  type McpCategory,
  type McpSubcategory,
  type McpSuperCategory,
  type McpToolDef,
  SUPER_CATEGORY_COUNT,
} from "./mcp-tool-registry";

interface ToolState {
  response: unknown;
  error: string | null;
  isExecuting: boolean;
}

type FilteredSubcategory = McpSubcategory & {
  _filteredTools?: Map<string, McpToolDef[]>;
};

export function McpCategoriesPageClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [toolState, setToolState] = useState<Record<string, ToolState>>({});

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (!q) return MCP_SUPER_CATEGORIES;

    return MCP_SUPER_CATEGORIES.map(sup => {
      const superMatches = sup.name.toLowerCase().includes(q);
      if (superMatches) return sup;

      const filteredSubs = sup.subcategories.map(sub => {
        const subMatches = sub.name.toLowerCase().includes(q);
        if (subMatches) return sub;

        const filteredCats = sub.categories.map(cat => {
          const catMatches = cat.name.toLowerCase().includes(q);
          if (catMatches) {
            return { category: cat, tools: getToolsByCategory(cat.id) };
          }

          const tools = getToolsByCategory(cat.id).filter(
            t =>
              t.name.toLowerCase().includes(q)
              || t.displayName.toLowerCase().includes(q)
              || t.description.toLowerCase().includes(q),
          );

          if (tools.length > 0) return { category: cat, tools };
          return null;
        }).filter((
          item,
        ): item is { category: McpCategory; tools: McpToolDef[]; } => item !== null);

        if (filteredCats.length === 0) return null;

        return {
          ...sub,
          categories: filteredCats.map(fc => fc.category),
          _filteredTools: new Map(
            filteredCats.map(fc => [fc.category.id, fc.tools]),
          ),
          toolCount: filteredCats.reduce((sum, fc) => sum + fc.tools.length, 0),
        };
      }).filter((item): item is FilteredSubcategory => item !== null);

      if (filteredSubs.length === 0) return null;

      return {
        ...sup,
        subcategories: filteredSubs,
        toolCount: filteredSubs.reduce((sum, s) => sum + s.toolCount, 0),
      };
    }).filter((
      item,
    ): item is McpSuperCategory & { subcategories: FilteredSubcategory[]; } => item !== null);
  }, [searchQuery]);

  const handleAccordionChange = useCallback(() => {
    setExpandedTool(null);
  }, []);

  const handleToolToggle = useCallback((toolName: string) => {
    setExpandedTool(prev => (prev === toolName ? null : toolName));
  }, []);

  const abortControllerRef = useRef<Record<string, AbortController>>({});

  const handleToolExecute = useCallback(
    async (tool: McpToolDef, params: Record<string, unknown>) => {
      // Abort any in-flight request for this tool
      abortControllerRef.current[tool.name]?.abort();
      const controller = new AbortController();
      abortControllerRef.current[tool.name] = controller;

      setToolState(prev => ({
        ...prev,
        [tool.name]: {
          response: prev[tool.name]?.response ?? null,
          error: null,
          isExecuting: true,
        },
      }));

      try {
        const res = await fetch("/api/mcp/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: tool.name, params }),
          signal: controller.signal,
        });

        const data: unknown = await res.json();

        if (!res.ok) {
          const errorMsg = typeof data === "object" && data !== null && "error" in data
            ? String((data as Record<string, unknown>).error)
            : `HTTP ${res.status}`;
          setToolState(prev => ({
            ...prev,
            [tool.name]: {
              response: null,
              error: errorMsg,
              isExecuting: false,
            },
          }));
          return;
        }

        setToolState(prev => ({
          ...prev,
          [tool.name]: { response: data, error: null, isExecuting: false },
        }));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setToolState(prev => ({
          ...prev,
          [tool.name]: {
            response: null,
            error: err instanceof Error ? err.message : "Unknown error",
            isExecuting: false,
          },
        }));
      }
    },
    [],
  );

  // Helper to get tools — uses filtered map if searching, else full list
  const getToolsForCategory = useCallback((
    catId: string,
    sub: FilteredSubcategory,
  ): McpToolDef[] => {
    if (sub._filteredTools) {
      return sub._filteredTools.get(catId) ?? [];
    }
    return getToolsByCategory(catId);
  }, []);

  return (
    <main className="min-h-screen container mx-auto px-4 py-8">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/mcp">MCP</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Tool Categories</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Tool Categories
        </h1>
        <p className="text-muted-foreground text-lg">
          {SUPER_CATEGORY_COUNT} categories
        </p>
      </div>

      <div className="mb-6 max-w-md">
        <Input
          placeholder="Search categories and tools..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredData.length === 0
        ? (
          <p className="text-muted-foreground py-12 text-center">
            No categories or tools match &ldquo;{searchQuery}&rdquo;
          </p>
        )
        : (
          <div className="space-y-10">
            {filteredData.map(superCat => {
              const SuperIcon = ICON_MAP[superCat.icon] as
                | React.ComponentType<{ className?: string; }>
                | undefined;
              return (
                <section key={superCat.id}>
                  <div className="flex items-center gap-3 mb-4 pb-2 border-b border-border/50">
                    {SuperIcon && <SuperIcon className="h-6 w-6 text-muted-foreground" />}
                    <h2 className="text-2xl font-bold tracking-tight">
                      {superCat.name}
                    </h2>
                    <Badge variant="secondary" className="ml-1">
                      {superCat.toolCount} tools
                    </Badge>
                  </div>

                  <Accordion
                    type="single"
                    collapsible
                    onValueChange={handleAccordionChange}
                    className="space-y-2"
                  >
                    {superCat.subcategories.map(sub => {
                      const SubIcon = ICON_MAP[sub.icon] as
                        | React.ComponentType<{ className?: string; }>
                        | undefined;
                      return (
                        <AccordionItem
                          key={sub.id}
                          value={`${superCat.id}-${sub.id}`}
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <span className="flex items-center gap-3">
                              {SubIcon && <SubIcon className="h-5 w-5 shrink-0" />}
                              <span className="font-semibold">{sub.name}</span>
                              <Badge variant="secondary" className="ml-1">
                                {sub.toolCount} {sub.toolCount === 1 ? "tool" : "tools"}
                              </Badge>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4 pl-4">
                              {sub.categories.map(cat => {
                                const CatIcon = ICON_MAP[cat.icon] as
                                  | React.ComponentType<{ className?: string; }>
                                  | undefined;
                                const catTools = getToolsForCategory(
                                  cat.id,
                                  sub as FilteredSubcategory,
                                );

                                // Skip rendering if no tools match
                                if (catTools.length === 0) return null;

                                // If subcategory has a single category, skip the nested header
                                if (sub.categories.length === 1) {
                                  return (
                                    <div
                                      key={cat.id}
                                      className="space-y-2 pl-4"
                                    >
                                      {catTools.map(tool => (
                                        <ToolItem
                                          key={tool.name}
                                          tool={tool}
                                          isExpanded={expandedTool
                                            === tool.name}
                                          toolState={toolState[tool.name]}
                                          onToggle={handleToolToggle}
                                          onExecute={handleToolExecute}
                                        />
                                      ))}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={cat.id}>
                                    <div className="flex items-center gap-2 mb-2">
                                      {CatIcon && (
                                        <CatIcon className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span className="text-sm font-medium">
                                        {cat.name}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {catTools.length}
                                      </Badge>
                                    </div>
                                    <div className="space-y-2 pl-6">
                                      {catTools.map(tool => (
                                        <ToolItem
                                          key={tool.name}
                                          tool={tool}
                                          isExpanded={expandedTool
                                            === tool.name}
                                          toolState={toolState[tool.name]}
                                          onToggle={handleToolToggle}
                                          onExecute={handleToolExecute}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </section>
              );
            })}
          </div>
        )}
    </main>
  );
}

function ToolItem({
  tool,
  isExpanded,
  toolState: ts,
  onToggle,
  onExecute,
}: {
  tool: McpToolDef;
  isExpanded: boolean;
  toolState: ToolState | undefined;
  onToggle: (name: string) => void;
  onExecute: (
    tool: McpToolDef,
    params: Record<string, unknown>,
  ) => Promise<void>;
}) {
  return (
    <div>
      <button
        type="button"
        className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
        onClick={() => onToggle(tool.name)}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">
            {tool.displayName}
          </span>
          {tool.tier === "workspace" && (
            <Badge variant="outline" className="text-xs">
              workspace
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {tool.description}
        </p>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-4 pl-3">
          <McpToolForm
            tool={tool}
            onSubmit={params => onExecute(tool, params)}
            isExecuting={ts?.isExecuting ?? false}
          />
          <McpResponseViewer
            response={ts?.response ?? null}
            error={ts?.error ?? null}
            isExecuting={ts?.isExecuting ?? false}
            responseType={tool.responseType}
          />
        </div>
      )}
    </div>
  );
}
