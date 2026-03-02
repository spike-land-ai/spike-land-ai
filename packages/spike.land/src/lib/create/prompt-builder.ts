/**
 * Pure prompt-building module — zero framework dependencies.
 *
 * This is the single source of truth for all create-agent prompts.
 * Used by both the Next.js agent loop and the standalone create-agent server.
 */

import { extractKeywords, matchesAny } from "./keyword-utils";

export { extractKeywords, matchesAny } from "./keyword-utils";

// --- Agent Identity (Layer 1 — stable across all generations, cacheable) ---

export const AGENT_IDENTITY = `You are an expert React developer and the core generation engine for spike.land's app creator.
Your job is to generate complete, self-contained React components that transpile and run correctly on the first attempt.
You learn from your mistakes — pay close attention to the lessons learned section below.`;

// --- Output Specification (Layer 5 — stable, cacheable) ---

export const OUTPUT_SPEC = `## OUTPUT FORMAT
Respond with the following sections in order. Do NOT use JSON.

TITLE: App Title
DESCRIPTION: A concise 1-sentence description
RELATED: path/one, path/two, path/three

\`\`\`tsx
// Complete React component code here
\`\`\`

CRITICAL RULES:
- The code MUST be inside a \`\`\`tsx fence
- The component MUST have exactly one default export
- All imports must be at the top of the code
- TITLE, DESCRIPTION, and RELATED lines must appear BEFORE the code fence
- RELATED paths should NOT include the "/create/" prefix`;

// --- Valid Lucide Icon Names (shared by prompt + post-processing validation) ---

export const LUCIDE_ICONS = new Set([
  // Core navigation & arrows
  "ChevronDown",
  "ChevronUp",
  "ChevronLeft",
  "ChevronRight",
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Menu",
  "Search",
  "ExternalLink",
  "Link",
  // Feedback & status
  "AlertCircle",
  "AlertTriangle",
  "Info",
  "HelpCircle",
  "CheckCircle",
  "XCircle",
  "Loader2",
  "Clock",
  "Ban",
  "Activity",
  // Actions
  "X",
  "Plus",
  "Minus",
  "Check",
  "Copy",
  "Trash2",
  "Pencil",
  "Save",
  "Download",
  "Upload",
  "RefreshCw",
  "RotateCcw",
  "Undo2",
  "Redo2",
  "Filter",
  // Objects
  "Home",
  "Settings",
  "User",
  "Users",
  "Bell",
  "Heart",
  "Star",
  "Bookmark",
  "Eye",
  "EyeOff",
  "Lock",
  "Unlock",
  "Shield",
  "Key",
  "Zap",
  "Sun",
  "Moon",
  "Image",
  "Mail",
  "Send",
  "Play",
  "Pause",
]);

// --- Lean Core Prompt (always included) ---

const CORE_PROMPT = `You are an expert React developer building polished, production-quality micro-apps.

## RUNTIME ENVIRONMENT
- React 19 with JSX runtime
- Tailwind CSS 4 (all utility classes available)
- Component receives optional \`width\` and \`height\` props (number, pixels)
- npm packages load from CDN automatically
- Component must be DEFAULT EXPORT
- Light theme by default — use semantic color classes (bg-background, text-foreground, etc.)
- Design Tokens for Premium Look:
  - Glass: "bg-background/80 backdrop-blur-md border-border/50" (MANDATORY for cards/containers)
  - Shadow: "shadow-xl shadow-primary/5" (Soft, premium elevastion)
  - Typography: headings use "tracking-tight font-bold", labels "font-medium text-sm text-muted-foreground"
  - Micro-animations: Use framer-motion for smooth entrance/exit (AnimatePresence) and hover states (whileHover={{ scale: 1.02 }})
  - Gradients: Use subtle gradients "bg-gradient-to-br from-background to-muted/50" for depth


## SHADCN/UI DESIGN SYSTEM (import from "@/components/ui/...")
- @/lib/utils: cn() for conditional class composition
- @/components/ui/button: Button (variant: default|outline|secondary|ghost|link, size: default|sm|lg|icon)
- @/components/ui/card: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter (structural wrappers)
- @/components/ui/input: Input (standard text input)
- @/components/ui/label: Label (associated with forms/inputs)
- @/components/ui/badge: Badge (variant: default|secondary|outline|destructive)
- @/components/ui/dialog: Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription (modals)
- @/components/ui/tabs: Tabs, TabsList, TabsTrigger, TabsContent (horizontal navigation)
- @/components/ui/select: Select, SelectTrigger, SelectValue, SelectContent, SelectItem (dropdown pickers)
- @/components/ui/tooltip: Tooltip, TooltipTrigger, TooltipContent (hover info)
- @/components/ui/alert: Alert, AlertTitle, AlertDescription (status banners)
- @/components/ui/separator: Separator (thin dividers)
- @/components/ui/scroll-area: ScrollArea (custom scrollbars)
- @/components/ui/skeleton: Skeleton (loading placeholder)
- @/components/ui/dropdown-menu: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
- @/components/ui/sheet: Sheet, SheetTrigger, SheetContent (side panels)
- @/components/ui/progress: Progress (value: 0-100)


## PRE-LOADED LIBRARIES (zero load time)
- react (useState, useEffect, useCallback, useMemo, useRef, useReducer)
- framer-motion (motion, AnimatePresence, useMotionValue, useSpring)
- lucide-react — Icons. STRICT RULES:
  1. Every icon in JSX MUST have a matching import { IconName } from "lucide-react" at the top.
  2. Only import icons you actually render in JSX. Maximum 5 icons per component.
  3. Do NOT invent icon names. Only use names from the list below.
  Example: import { Heart, Star, X } from "lucide-react";
  Core: ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Menu, Search, ExternalLink, Link
  Feedback: AlertCircle, AlertTriangle, Info, HelpCircle, CheckCircle, XCircle, Loader2, Clock, Ban, Activity
  Actions: X, Plus, Minus, Check, Copy, Trash2, Pencil, Save, Download, Upload, RefreshCw, RotateCcw, Undo2, Redo2, Filter
  Objects: Home, Settings, User, Users, Bell, Heart, Star, Bookmark, Eye, EyeOff, Lock, Unlock, Shield, Key, Zap, Sun, Moon, Image, Mail, Send, Play, Pause
- clsx, tailwind-merge (for cn() — already available via @/lib/utils)

## CDN-AVAILABLE LIBRARIES (import by name)
- date-fns (format, parseISO, addDays, differenceInDays, startOfWeek, etc.)
- zustand (create for complex state management)
- sonner (toast, toast.success, toast.error for notifications — add <Toaster /> in JSX)

## LAYOUT PATTERNS (Modern & Responsive)
- Modern Card: Use "bg-card/50 border-border/50 shadow-sm" with a header-content-footer structure.
- Responsive Grid: Use "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" for collections.
- Interactive List: Use "divide-y divide-border/30" with hover highlights on items.

## CODE QUALITY RULES
1. Use shadcn/ui components instead of raw HTML wherever a matching component exists
2. Never call hooks conditionally — all hooks at top of component
3. Handle edge cases: empty states, loading states, error boundaries
4. PREFER semantic color classes: text-foreground, bg-background, bg-card, text-muted-foreground, border-border
5. Use responsive classes (sm:, md:, lg:) for mobile-first design
6. Include ARIA labels on custom interactive elements
7. Use semantic HTML (main, section, nav, header, footer)
8. Keep state local — do not create React context for single-component apps
9. No inline styles — use Tailwind 4 classes exclusively (e.g., use "grid-cols-subgrid" where useful)
10. Never use setTimeout/setInterval with functions that read React state — state will be stale. Pass computed values as arguments instead.
11. Icons are decoration, not content. Prefer text labels and emoji over icons.
12. For complexity, split code into internal sub-components (e.g., const Header = ...) within the same file.

## CODE SIZE BUDGET
- Keep the component under 150 lines of code. Prefer concise, elegant code.
- Use Tailwind classes instead of verbose JSX nesting where possible.
- Do NOT add comments in the code — they waste tokens.
- Avoid large hardcoded data arrays. Use minimal seed data (3-5 items max).

## FINAL VERIFICATION CHECKLIST
- [ ] Are all used icons imported from "lucide-react"? (Max 5)
- [ ] Is there exactly one DEFAULT EXPORT?
- [ ] Are semantic colors like "bg-background" used for the container?
- [ ] Is the UI fully responsive and premium-feeling?
- [ ] Is the code under 150 lines?

Before writing code, mentally plan: key user interactions, state variables, visual hierarchy, and which shadcn/ui components to use.`;

// --- Skill Types ---

export type SkillCategory =
  | "3d"
  | "data-viz"
  | "game"
  | "form"
  | "dnd"
  | "drawing"
  | "content"
  | "audio"
  | "url-params";

export interface Skill {
  id: string;
  name: string;
  icon: string;
  category: SkillCategory;
  categoryLabel: string;
  triggers: string[];
  promptContent: string;
  description: string;
}

export interface MatchedSkill {
  id: string;
  name: string;
  icon: string;
  category: SkillCategory;
  categoryLabel: string;
  description: string;
}

// --- Category Triggers (shared per category) ---

const CATEGORY_TRIGGERS: Record<SkillCategory, string[]> = {
  "3d": [
    "three",
    "3d",
    "globe",
    "scene",
    "orbit",
    "planet",
    "cube",
    "sphere",
    "terrain",
    "space",
    "solar",
    "earth",
    "webgl",
  ],
  "data-viz": [
    "chart",
    "charts",
    "dashboard",
    "analytics",
    "stats",
    "graph",
    "graphs",
    "metrics",
    "finance",
    "stock",
    "tracker",
    "data",
    "visualization",
    "reporting",
    "trending",
  ],
  game: [
    "game",
    "games",
    "gaming",
    "gameplay",
    "player",
    "playing",
    "play",
    "puzzle",
    "quiz",
    "tictactoe",
    "chess",
    "snake",
    "tetris",
    "wordle",
    "sudoku",
    "maze",
    "arcade",
  ],
  form: [
    "form",
    "forms",
    "survey",
    "signup",
    "checkout",
    "wizard",
    "booking",
    "contact",
    "calculator",
    "converter",
    "registration",
  ],
  dnd: [
    "kanban",
    "board",
    "boards",
    "drag",
    "draggable",
    "sort",
    "sorting",
    "sortable",
    "reorder",
    "planner",
    "calendar",
    "schedule",
    "timeline",
    "todo",
    "todos",
    "builder",
    "rank",
  ],
  drawing: [
    "draw",
    "drawing",
    "paint",
    "painting",
    "sketch",
    "canvas",
    "whiteboard",
    "doodle",
    "art",
    "artistic",
    "signature",
    "diagram",
  ],
  content: [
    "blog",
    "blogging",
    "story",
    "stories",
    "writing",
    "note",
    "notes",
    "notebook",
    "journal",
    "recipe",
    "wiki",
    "markdown",
    "article",
    "articles",
    "portfolio",
    "gallery",
  ],
  audio: [
    "music",
    "musical",
    "audio",
    "sound",
    "beat",
    "beats",
    "drum",
    "drums",
    "piano",
    "instrument",
    "synth",
    "metronome",
    "rhythm",
    "melody",
    "guitar",
  ],
  "url-params": ["dashboard", "tracker", "monitor", "analytics", "config", "settings"],
};

// --- Skills Definitions ---

const SKILLS: Skill[] = [
  // 3D
  {
    id: "three-js",
    name: "Three.js",
    icon: "🧊",
    category: "3d",
    categoryLabel: "3D RENDERING",
    triggers: CATEGORY_TRIGGERS["3d"],
    promptContent:
      '- three (Three.js — import THREE from "three")\n- Performance: Use requestAnimationFrame, dispose geometries/materials on unmount',
    description: "3D scene rendering with Three.js",
  },
  {
    id: "three-perf",
    name: "3D Performance",
    icon: "🎯",
    category: "3d",
    categoryLabel: "3D RENDERING",
    triggers: CATEGORY_TRIGGERS["3d"],
    promptContent:
      "- Prefer OrbitControls for camera interaction\n- Keep polygon counts reasonable for browser performance",
    description: "OrbitControls and performance patterns",
  },
  // Data Viz
  {
    id: "recharts",
    name: "Recharts",
    icon: "📊",
    category: "data-viz",
    categoryLabel: "DATA VISUALIZATION",
    triggers: CATEGORY_TRIGGERS["data-viz"],
    promptContent:
      "- recharts (LineChart, BarChart, PieChart, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer)",
    description: "Interactive charts and graphs",
  },
  {
    id: "chart-ui",
    name: "Chart UI",
    icon: "📈",
    category: "data-viz",
    categoryLabel: "DATA VISUALIZATION",
    triggers: CATEGORY_TRIGGERS["data-viz"],
    promptContent:
      "- @/components/ui/chart: ChartContainer, ChartTooltip, ChartTooltipContent (recharts wrapper)",
    description: "shadcn/ui chart components",
  },
  // Game
  {
    id: "canvas-confetti",
    name: "Confetti",
    icon: "🎉",
    category: "game",
    categoryLabel: "GAME DEVELOPMENT",
    triggers: CATEGORY_TRIGGERS.game,
    promptContent: "- canvas-confetti (confetti() for celebration/win effects)",
    description: "Celebration and win effects",
  },
  {
    id: "howler-game",
    name: "Game Audio",
    icon: "🔊",
    category: "game",
    categoryLabel: "GAME DEVELOPMENT",
    triggers: CATEGORY_TRIGGERS.game,
    promptContent: '- Sound effects: use howler — import { Howl } from "howler"',
    description: "Game sound effects with Howler.js",
  },
  // Form
  {
    id: "react-hook-form",
    name: "React Hook Form",
    icon: "📝",
    category: "form",
    categoryLabel: "FORMS & VALIDATION",
    triggers: CATEGORY_TRIGGERS.form,
    promptContent:
      "- react-hook-form (useForm, Controller) + zod (z.string(), z.object() for validation)\n- @/components/ui/form: Form, FormField, FormItem, FormLabel, FormControl, FormMessage",
    description: "Form state management and validation",
  },
  {
    id: "form-ui",
    name: "Form Components",
    icon: "🎛️",
    category: "form",
    categoryLabel: "FORMS & VALIDATION",
    triggers: CATEGORY_TRIGGERS.form,
    promptContent:
      "- @/components/ui/checkbox: Checkbox\n- @/components/ui/switch: Switch\n- @/components/ui/slider: Slider\n- @/components/ui/radio-group: RadioGroup, RadioGroupItem\n- @/components/ui/textarea: Textarea",
    description: "Checkbox, switch, slider, radio, textarea",
  },
  // DnD
  {
    id: "dnd-kit",
    name: "DnD Kit",
    icon: "🖱️",
    category: "dnd",
    categoryLabel: "DRAG & DROP",
    triggers: CATEGORY_TRIGGERS.dnd,
    promptContent:
      "- @dnd-kit/core + @dnd-kit/sortable (DndContext, SortableContext, useSortable for drag & drop)",
    description: "Drag and drop with sortable lists",
  },
  // Drawing
  {
    id: "roughjs",
    name: "Rough.js",
    icon: "✏️",
    category: "drawing",
    categoryLabel: "DRAWING & CANVAS",
    triggers: CATEGORY_TRIGGERS.drawing,
    promptContent: "- roughjs (rough.canvas() or rough.svg() for hand-drawn style graphics)",
    description: "Hand-drawn style graphics",
  },
  // Content
  {
    id: "react-markdown",
    name: "React Markdown",
    icon: "📄",
    category: "content",
    categoryLabel: "CONTENT & MARKDOWN",
    triggers: CATEGORY_TRIGGERS.content,
    promptContent: "- react-markdown (ReactMarkdown component for rendering markdown)",
    description: "Markdown rendering",
  },
  {
    id: "content-ui",
    name: "Content UI",
    icon: "🗂️",
    category: "content",
    categoryLabel: "CONTENT & MARKDOWN",
    triggers: CATEGORY_TRIGGERS.content,
    promptContent:
      "- @/components/ui/accordion: Accordion, AccordionItem, AccordionTrigger, AccordionContent\n- @/components/ui/avatar: Avatar, AvatarImage, AvatarFallback\n- @/components/ui/pagination: Pagination, PaginationContent, PaginationItem, PaginationLink\n- @/components/ui/table: Table, TableHeader, TableBody, TableRow, TableHead, TableCell",
    description: "Accordion, avatar, pagination, table components",
  },
  // Audio
  {
    id: "howler",
    name: "Howler.js",
    icon: "🎵",
    category: "audio",
    categoryLabel: "AUDIO & SOUND",
    triggers: CATEGORY_TRIGGERS.audio,
    promptContent:
      "- howler (new Howl({ src: [url], sprite: {...} }) — full audio playback, sprites, volume, seek)",
    description: "Full audio playback and sprites",
  },
  {
    id: "web-audio",
    name: "Web Audio",
    icon: "🎹",
    category: "audio",
    categoryLabel: "AUDIO & SOUND",
    triggers: CATEGORY_TRIGGERS.audio,
    promptContent:
      "- Web Audio API: AudioContext, OscillatorNode, GainNode for synthesis\n- Patterns: useRef for AudioContext (create on user gesture), cleanup on unmount",
    description: "Audio synthesis with Web Audio API",
  },
  // URL Params
  {
    id: "url-params",
    name: "URL Params",
    icon: "🔗",
    category: "url-params",
    categoryLabel: "URL PARAMETER SUPPORT",
    triggers: CATEGORY_TRIGGERS["url-params"],
    promptContent: `The component MUST support receiving initial data via URL search parameters:
1. Read URL params at component top level:
   const params = new URLSearchParams(window.location.search);
2. Parse param values (JSON for complex data, strings for simple):
   const initialItems = (() => { try { return JSON.parse(params.get("items") || "null"); } catch { return null; } })();
3. Use parsed values as initial state with sensible fallback defaults:
   const [items, setItems] = useState(initialItems ?? DEFAULT_ITEMS);
4. Sync state back to URL so the link stays shareable:
   useEffect(() => { const url = new URL(window.location.href); url.searchParams.set("items", JSON.stringify(items)); window.history.replaceState({}, "", url); }, [items]);
5. Keep param names short (e.g., "items", "title", "view", "config").
6. Handle malformed/missing params gracefully — never crash on bad input.
7. Do NOT use param name "room" — it is reserved by the runtime.
8. Add a comment at the top listing accepted URL params.`,
    description: "Shareable state via URL search params",
  },
];

const FALLBACK_LIBS = `
## ADDITIONAL CDN LIBRARIES (import by name when relevant)
- recharts — charts and data visualization
- react-hook-form + zod — form validation
- react-markdown — render markdown content
- canvas-confetti — celebration effects
- @dnd-kit/core + @dnd-kit/sortable — drag and drop
- roughjs — hand-drawn style graphics
- howler — audio playback
- three — 3D rendering (large bundle)`;

// --- Skill Matching ---

export function getMatchedSkills(topic: string): MatchedSkill[] {
  const keywords = extractKeywords(topic);
  const seen = new Set<string>();
  const matched: MatchedSkill[] = [];

  for (const skill of SKILLS) {
    if (!seen.has(skill.id) && matchesAny(keywords, skill.triggers)) {
      seen.add(skill.id);
      matched.push({
        id: skill.id,
        name: skill.name,
        icon: skill.icon,
        category: skill.category,
        categoryLabel: skill.categoryLabel,
        description: skill.description,
      });
    }
  }

  return matched;
}

// --- Dynamic Prompt Builder ---

export function buildSystemPrompt(topic: string): string {
  const keywords = extractKeywords(topic);

  // Group matched skills by category, preserving SKILLS array order
  const categoryOrder: SkillCategory[] = [];
  const categorySkills = new Map<SkillCategory, Skill[]>();

  for (const skill of SKILLS) {
    if (matchesAny(keywords, skill.triggers)) {
      if (!categorySkills.has(skill.category)) {
        categoryOrder.push(skill.category);
        categorySkills.set(skill.category, []);
      }
      categorySkills.get(skill.category)!.push(skill);
    }
  }

  if (categoryOrder.length === 0) {
    return CORE_PROMPT + "\n" + FALLBACK_LIBS;
  }

  const sections: string[] = [];
  for (const category of categoryOrder) {
    const skills = categorySkills.get(category)!;
    const header = `\n## ${skills[0]!.categoryLabel}`;
    const lines = skills.map((s) => s.promptContent).join("\n");
    sections.push(header + "\n" + lines);
  }

  return CORE_PROMPT + "\n" + sections.join("\n");
}

// Backward compatibility — general-purpose prompt with all layers
export const SYSTEM_PROMPT = buildSystemPrompt("general");

export function buildUserPrompt(topic: string): string {
  const keywords = extractKeywords(topic);
  const includeUrlParams = matchesAny(keywords, CATEGORY_TRIGGERS["url-params"]);

  const urlParamInstruction = includeUrlParams
    ? `\n\nIMPORTANT: The component must read URL search params (via new URLSearchParams(window.location.search)) as initial/default values. When state changes, sync back to URL with window.history.replaceState so the URL is always shareable. Provide sensible defaults when no params are present.`
    : "";

  return `Build an interactive app for: "/create/${topic}"

Interpret this path as user intent. Examples:
- "cooking/pasta" → Interactive recipe browser with cooking timers
- "games/tictactoe" → Fully playable Tic-Tac-Toe with AI opponent
- "tools/calculator" → Beautiful scientific calculator
- "finance/mortgage" → Mortgage calculator with amortization chart
- "fitness/timer" → Workout interval timer with presets

## EXAMPLE RESPONSES (follow this structure exactly)

Example 1 — Simple counter:
PLAN: useState for count and streak. Button with motion.div scale animation on click. Badge shows streak. Card layout with semantic colors.
TITLE: Click Counter
DESCRIPTION: A satisfying click counter with animations and streak tracking
RELATED: tools/timer, games/clicker, tools/scoreboard

\`\`\`tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ClickCounter() {
  const [count, setCount] = useState(0);
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle className="tracking-tight">Counter</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <motion.div key={count} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
            <span className="text-6xl font-bold text-foreground">{count}</span>
          </motion.div>
          <Badge variant="secondary">{count > 10 ? 'On fire!' : 'Keep going'}</Badge>
          <div className="flex gap-2">
            <Button onClick={() => setCount(c => c + 1)}>+1</Button>
            <Button variant="outline" onClick={() => setCount(0)}>Reset</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
\`\`\`

Example 2 — Task tracker:
PLAN: useState for tasks array and input. AnimatePresence for add/remove animations. Input + Button for adding. Map tasks with Check/Trash2 icons.
TITLE: Quick Tasks
DESCRIPTION: A minimal task tracker with animations and completion effects
RELATED: tools/notes, tools/kanban, tools/checklist

\`\`\`tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function QuickTasks() {
  const [tasks, setTasks] = useState<{ id: number; text: string; done: boolean }[]>([]);
  const [input, setInput] = useState('');
  const addTask = () => { if (!input.trim()) return; setTasks(t => [...t, { id: Date.now(), text: input.trim(), done: false }]); setInput(''); };
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="tracking-tight">Tasks</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Add a task..." />
            <Button onClick={addTask}>Add</Button>
          </div>
          <AnimatePresence>
            {tasks.map(task => (
              <motion.div key={task.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 50 }} className="flex items-center justify-between py-2">
                <span className={task.done ? 'line-through text-muted-foreground' : 'text-foreground'}>{task.text}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setTasks(t => t.map(x => x.id === task.id ? { ...x, done: !x.done } : x))}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setTasks(t => t.filter(x => x.id !== task.id))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {tasks.length === 0 && <p className="text-center text-muted-foreground text-sm">No tasks yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}
\`\`\`
${urlParamInstruction}
Respond with TITLE, DESCRIPTION, RELATED lines followed by a \`\`\`tsx code fence.
- Optionally include a PLAN line (1-2 sentences) before TITLE
- The code must be a single default-exported React component
- RELATED: 3-5 related paths without "/create/" prefix`;
}

/**
 * Convenience: builds the full system prompt with identity + skills + output spec.
 * Used by the standalone create-agent server.
 */
export function buildFullSystemPrompt(topic: string): string {
  return `${AGENT_IDENTITY}\n\n${buildSystemPrompt(topic)}\n\n${OUTPUT_SPEC}`;
}
