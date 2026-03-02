"use client";

import { memo, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Menu, Search, X } from "lucide-react";

import { ICON_MAP } from "@/components/mcp/mcp-icon-map";
import type {
  McpSubcategory,
  McpSuperCategory,
  McpToolDef,
  ToolSearchResult,
} from "@/components/mcp/mcp-tool-registry";
import {
  getSubcategoryForCategory,
  getSuperCategoryForCategory,
  getToolsByCategory,
  MCP_SUPER_CATEGORIES,
  searchToolsSemantic,
} from "@/components/mcp/mcp-tool-registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface McpToolSidebarProps {
  selectedTool: McpToolDef | null;
  onSelectTool: (tool: McpToolDef) => void;
  initialCategory?: string | undefined;
}

function SearchInput({
  query,
  onChange,
  onClear,
}: {
  query: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search tools..."
        value={query}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 pl-8 pr-8 text-xs bg-white/5 border-white/10"
      />
      {query && (
        <button
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SearchResults({
  results,
  selectedTool,
  onSelectTool,
  onToolClick,
}: {
  results: ToolSearchResult[];
  selectedTool: McpToolDef | null;
  onSelectTool: (tool: McpToolDef) => void;
  onToolClick?: (() => void) | undefined;
}) {
  return (
    <div className="space-y-0.5">
      {results.map(({ tool, score }) => (
        <button
          key={tool.name}
          onClick={() => {
            onSelectTool(tool);
            onToolClick?.();
          }}
          className={cn(
            "w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-200 flex items-center gap-2",
            selectedTool?.name === tool.name
              ? "bg-primary/20 text-primary font-medium"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
          )}
        >
          <span className="flex-1 truncate">{tool.displayName}</span>
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 shrink-0 bg-black/10 border-white/10"
          >
            {tool.category}
          </Badge>
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 shrink-0 bg-primary/10 border-primary/20 text-primary"
          >
            {Math.round(score * 100)}%
          </Badge>
        </button>
      ))}
    </div>
  );
}

function SidebarContent({
  selectedTool,
  onSelectTool,
  initialCategory,
  onToolClick,
}: McpToolSidebarProps & { onToolClick?: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    return searchToolsSemantic(searchQuery.trim());
  }, [searchQuery]);

  const initialSuperId = initialCategory ? getSuperCategoryForCategory(initialCategory) : undefined;
  const initialSubId = initialCategory ? getSubcategoryForCategory(initialCategory) : undefined;

  return (
    <>
      <SearchInput
        query={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery("")}
      />
      <ScrollArea className="h-full pr-4">
        {searchQuery.trim().length >= 2 ? (
          searchResults.length > 0 ? (
            <SearchResults
              results={searchResults}
              selectedTool={selectedTool}
              onSelectTool={onSelectTool}
              onToolClick={onToolClick}
            />
          ) : (
            <p className="text-xs text-muted-foreground px-3 py-4">
              No tools found for &ldquo;{searchQuery}&rdquo;
            </p>
          )
        ) : (
          <div className="space-y-1 p-1">
            {MCP_SUPER_CATEGORIES.map((superCat) => (
              <SuperCategoryGroup
                key={superCat.id}
                superCategory={superCat}
                defaultOpen={superCat.id === initialSuperId}
                initialSubId={initialSubId}
                initialCategory={initialCategory}
                selectedTool={selectedTool}
                onSelectTool={onSelectTool}
                onToolClick={onToolClick}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
}

function SuperCategoryGroup({
  superCategory,
  defaultOpen,
  initialSubId,
  initialCategory,
  selectedTool,
  onSelectTool,
  onToolClick,
}: {
  superCategory: McpSuperCategory;
  defaultOpen: boolean;
  initialSubId?: string | undefined;
  initialCategory?: string | undefined;
  selectedTool: McpToolDef | null;
  onSelectTool: (tool: McpToolDef) => void;
  onToolClick?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon: LucideIcon = ICON_MAP[superCategory.icon] ?? ICON_MAP.Compass!;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-1">
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-white/5 transition-colors group">
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
            <Icon className="h-4 w-4" />
          </span>
          <span className="flex-1 text-left">{superCategory.name}</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 min-w-[1.25rem] justify-center bg-black/20 border-white/10"
          >
            {superCategory.toolCount}
          </Badge>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pl-3 pt-0.5 animate-accordion-down">
        {superCategory.subcategories.map((sub) => (
          <SubcategoryGroup
            key={sub.id}
            subcategory={sub}
            defaultOpen={sub.id === initialSubId}
            initialCategory={initialCategory}
            selectedTool={selectedTool}
            onSelectTool={onSelectTool}
            onToolClick={onToolClick}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SubcategoryGroup({
  subcategory,
  defaultOpen,
  initialCategory,
  selectedTool,
  onSelectTool,
  onToolClick,
}: {
  subcategory: McpSubcategory;
  defaultOpen: boolean;
  initialCategory?: string | undefined;
  selectedTool: McpToolDef | null;
  onSelectTool: (tool: McpToolDef) => void;
  onToolClick?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon: LucideIcon = ICON_MAP[subcategory.icon] ?? ICON_MAP.Compass!;

  // Optimization: if subcategory has only 1 category, skip the category level
  const singleCategory = subcategory.categories.length === 1;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-0.5">
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-white/5 transition-colors group">
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1 text-left">{subcategory.name}</span>
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 min-w-[1rem] justify-center bg-black/10 border-white/10"
          >
            {subcategory.toolCount}
          </Badge>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pl-3 pt-0.5 animate-accordion-down">
        {singleCategory ? (
          // Single category → show tools directly
          <ToolList
            categoryId={subcategory.categories[0]!.id}
            selectedTool={selectedTool}
            onSelectTool={onSelectTool}
            onToolClick={onToolClick}
          />
        ) : (
          // Multiple categories → show category groups
          subcategory.categories.map((cat) => (
            <CategoryGroup
              key={cat.id}
              category={cat}
              defaultOpen={cat.id === initialCategory}
              selectedTool={selectedTool}
              onSelectTool={onSelectTool}
              onToolClick={onToolClick}
            />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function CategoryGroup({
  category,
  defaultOpen,
  selectedTool,
  onSelectTool,
  onToolClick,
}: {
  category: { id: string; name: string; icon: string; toolCount: number };
  defaultOpen: boolean;
  selectedTool: McpToolDef | null;
  onSelectTool: (tool: McpToolDef) => void;
  onToolClick?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon: LucideIcon = ICON_MAP[category.icon] ?? ICON_MAP.Compass!;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-0.5">
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground/70 hover:bg-white/5 transition-colors group">
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">
            <Icon className="h-3 w-3" />
          </span>
          <span className="flex-1 text-left">{category.name}</span>
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 h-4 min-w-[1rem] justify-center bg-black/10 border-white/10"
          >
            {category.toolCount}
          </Badge>
          <ChevronDown
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pl-3 pt-0.5 animate-accordion-down">
        <ToolList
          categoryId={category.id}
          selectedTool={selectedTool}
          onSelectTool={onSelectTool}
          onToolClick={onToolClick}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

const ToolList = memo(function ToolList({
  categoryId,
  selectedTool,
  onSelectTool,
  onToolClick,
}: {
  categoryId: string;
  selectedTool: McpToolDef | null;
  onSelectTool: (tool: McpToolDef) => void;
  onToolClick?: (() => void) | undefined;
}) {
  const tools = useMemo(() => getToolsByCategory(categoryId), [categoryId]);

  return (
    <>
      {tools.map((tool) => (
        <button
          key={tool.name}
          onClick={() => {
            onSelectTool(tool);
            onToolClick?.();
          }}
          className={cn(
            "w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all duration-200",
            selectedTool?.name === tool.name
              ? "bg-primary/20 text-primary border-l-2 border-primary font-medium pl-2.5"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground pl-3 border-l-2 border-transparent",
          )}
        >
          {tool.displayName}
        </button>
      ))}
    </>
  );
});

export function McpToolSidebar(props: McpToolSidebarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Mobile: Sheet trigger */}
      <div className="lg:hidden mb-4">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Menu className="h-4 w-4" />
                Browse Tools
              </span>
              <Badge variant="secondary" className="ml-auto">
                {props.selectedTool?.displayName || "Select a tool"}
              </Badge>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetHeader className="p-6 border-b border-white/10">
              <SheetTitle>MCP Tools</SheetTitle>
            </SheetHeader>
            <div className="p-4 h-[calc(100dvh-5rem)]">
              <SidebarContent {...props} onToolClick={() => setSheetOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Permanent sidebar */}
      <div className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-24 h-[calc(100dvh-6rem)] glass-1 glass-edge rounded-2xl p-4 overflow-hidden flex flex-col shadow-xl">
          <div className="mb-4 px-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Available Tools
            </h3>
          </div>
          <SidebarContent {...props} />
        </div>
      </div>
    </>
  );
}
