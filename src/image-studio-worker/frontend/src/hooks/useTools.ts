import { useState, useEffect, useMemo } from "react";
import { listTools, type ToolInfo } from "@/api/client";

const CATEGORY_MAP: Record<string, string> = {
  img_generate: "Generation",
  img_edit: "Generation",
  img_icon: "Asset Generators",
  img_avatar: "Asset Generators",
  img_banner: "Asset Generators",
  img_screenshot: "Asset Generators",
  img_diagram: "Asset Generators",
  img_enhance: "Enhancement",
  img_remove_bg: "Enhancement",
  img_crop: "Enhancement",
  img_watermark: "Enhancement",
  img_blend: "Enhancement",
  img_resize: "Enhancement",
  img_analyze: "Analysis",
  img_compare: "Analysis",
  img_auto_tag: "Analysis",
  img_upload: "Library",
  img_list: "Library",
  img_delete: "Library",
  img_update: "Library",
  img_bulk_delete: "Library",
  img_duplicate: "Library",
  img_share: "Sharing",
  img_versions: "Sharing",
  img_export: "Sharing",
  img_job_status: "Status",
  img_credits: "Status",
  img_history: "Status",
};

function getCategory(name: string): string {
  if (CATEGORY_MAP[name]) return CATEGORY_MAP[name];
  if (name.startsWith("img_album")) return "Albums";
  if (name.startsWith("img_pipeline")) return "Pipelines";
  if (name.startsWith("img_subject")) return "Subjects";
  if (name.startsWith("img_brand")) return "Brand Kit";
  if (name.startsWith("img_storyboard")) return "Storyboard";
  if (name.startsWith("img_ref")) return "Reference Gen";
  if (name.startsWith("img_grounded")) return "Grounded";
  if (name.startsWith("img_style")) return "Enhancement";
  if (name.startsWith("img_current_event")) return "Generation";
  return "Other";
}

export interface ToolsState {
  tools: ToolInfo[];
  byName: Map<string, ToolInfo>;
  grouped: Map<string, ToolInfo[]>;
  categories: string[];
  loading: boolean;
  error: string | null;
}

export function useTools(): ToolsState {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTools()
      .then((data) => {
        if (!cancelled) {
          setTools(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tools");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byName = useMemo(() => {
    const map = new Map<string, ToolInfo>();
    for (const t of tools) map.set(t.name, t);
    return map;
  }, [tools]);

  const grouped = useMemo(() => {
    const map = new Map<string, ToolInfo[]>();
    for (const t of tools) {
      const cat = getCategory(t.name);
      const arr = map.get(cat) ?? [];
      arr.push(t);
      map.set(cat, arr);
    }
    return map;
  }, [tools]);

  const categories = useMemo(() => Array.from(grouped.keys()).sort(), [grouped]);

  return { tools, byName, grouped, categories, loading, error };
}
