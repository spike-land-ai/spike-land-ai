import { toast } from "sonner";
import { useState } from "react";
import { Download, History, Link, Unlink } from "lucide-react";
import { Button, Input, Select, Badge, ImagePicker } from "@/components/ui";
import { callTool, parseToolResult } from "@/api/client";
import { EXPORT_FORMATS } from "@/constants/enums";

type Tab = "share" | "export" | "versions";

export function ShareExport() {
  const [tab, setTab] = useState<Tab>("share");
  const [imageId, setImageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  // Export
  const [exportFormat, setExportFormat] = useState("png");
  const [exportQuality, setExportQuality] = useState("85");
  // Versions
  const [versions, setVersions] = useState<Array<Record<string, unknown>>>([]);

  const handleShare = async () => {
    if (!imageId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await callTool("img_share", { image_id: imageId });
      setResult(parseToolResult<Record<string, unknown>>(res));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Share failed");
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async () => {
    if (!imageId.trim()) return;
    setLoading(true);
    try {
      await callTool("img_share", { image_id: imageId, share: false });
      setResult({ unshared: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unshare failed");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!imageId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await callTool("img_export", {
        image_id: imageId,
        format: exportFormat,
        quality: Number(exportQuality),
      });
      setResult(parseToolResult<Record<string, unknown>>(res));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVersions = async () => {
    if (!imageId.trim()) return;
    setLoading(true);
    try {
      const res = await callTool("img_versions", { image_id: imageId });
      const data = parseToolResult<{ versions: Array<Record<string, unknown>> }>(res);
      setVersions(data.versions ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Share & Export</h2>
        <p className="text-gray-400 mt-1">Share, export, and manage image versions</p>
      </div>
      <ImagePicker
        label="Image"
        value={imageId}
        onChange={setImageId}
        placeholder="Select image to share or export"
      />
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
        {(["share", "export", "versions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setResult(null);
            }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? "bg-accent-600 text-white" : "text-gray-400 hover:bg-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "share" && (
        <div className="flex gap-3">
          <Button onClick={handleShare} loading={loading} disabled={!imageId.trim()}>
            <Link className="w-4 h-4" /> Share
          </Button>
          <Button
            variant="danger"
            onClick={handleUnshare}
            loading={loading}
            disabled={!imageId.trim()}
          >
            <Unlink className="w-4 h-4" /> Unshare
          </Button>
        </div>
      )}

      {tab === "export" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              options={EXPORT_FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
            />
            <Input
              label="Quality (1-100)"
              type="number"
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value)}
            />
          </div>
          <Button onClick={handleExport} loading={loading} disabled={!imageId.trim()}>
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>
      )}

      {tab === "versions" && (
        <div className="space-y-3">
          <Button onClick={handleVersions} loading={loading} disabled={!imageId.trim()}>
            <History className="w-4 h-4" /> Load Versions
          </Button>
          {versions.length > 0 && (
            <div className="space-y-2">
              {versions.map((v, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg"
                >
                  <div>
                    <span className="text-sm text-gray-300">Version {i + 1}</span>
                    {"tier" in v && <Badge className="ml-2">{String(v.tier)}</Badge>}
                  </div>
                  <span className="text-xs text-gray-500">{String(v.createdAt ?? "")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          {"shareUrl" in result && (
            <p className="text-sm text-accent-400 break-all">{String(result.shareUrl)}</p>
          )}
          {"url" in result && (
            <a
              href={String(result.url)}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent-400 underline"
            >
              Download
            </a>
          )}
          {Boolean(result.unshared) && (
            <p className="text-sm text-green-400">Image unshared successfully</p>
          )}
          {!result.shareUrl && !result.url && !result.unshared && (
            <pre className="text-xs text-gray-400 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
