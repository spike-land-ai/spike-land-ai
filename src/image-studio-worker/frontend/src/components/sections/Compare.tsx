import { toast } from "sonner";
import { useState } from "react";
import { GitCompare } from "lucide-react";
import { Button, CreditBadge, ImagePicker } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";

interface CompareResult {
  similarity: number;
  differences: string[];
}

export function Compare() {
  const [image1Id, setImage1Id] = useState("");
  const [image2Id, setImage2Id] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);

  const handleCompare = async () => {
    if (!image1Id.trim() || !image2Id.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await callTool("img_compare", {
        image1_id: image1Id,
        image2_id: image2Id,
      });
      const data = parseToolResult<{ comparison: CompareResult }>(res);
      setResult(data.comparison);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Compare</h2>
        <p className="text-gray-400 mt-1">Compare two images side by side</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImagePicker
          label="Image 1 ID"
          value={image1Id}
          onChange={setImage1Id}
          placeholder="First image"
        />
        <ImagePicker
          label="Image 2 ID"
          value={image2Id}
          onChange={setImage2Id}
          placeholder="Second image"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleCompare}
          loading={loading}
          disabled={!image1Id.trim() || !image2Id.trim()}
        >
          <GitCompare className="w-4 h-4" /> Compare
        </Button>
        <CreditBadge cost={1} />
      </div>

      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-accent-400">
                {Math.round(result.similarity * 100)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Similarity</p>
            </div>
            <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-500 rounded-full transition-all"
                style={{ width: `${result.similarity * 100}%` }}
              />
            </div>
          </div>

          {result.differences.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Differences</h4>
              <ul className="space-y-1">
                {result.differences.map((diff, i) => (
                  <li key={i} className="text-sm text-gray-400 pl-3 border-l-2 border-gray-700">
                    {diff}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
