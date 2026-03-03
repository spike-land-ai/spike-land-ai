"use client";

import { useRef, useState } from "react";
import { Check, Copy, Download, FileJson, Upload, X } from "lucide-react";
import type { MachineExport } from "@/lib/state-machine/types";

interface ImportExportDialogProps {
  isOpen: boolean;
  mode: "export" | "import";
  exportData: MachineExport | null;
  onClose: () => void;
  onImport: (json: string) => void;
}

export function ImportExportDialog({
  isOpen,
  mode,
  exportData,
  onClose,
  onImport,
}: ImportExportDialogProps) {
  const [importText, setImportText] = useState("");
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const exportJson = exportData ? JSON.stringify(exportData, null, 2) : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    if (!exportData) return;
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportData.definition.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    try {
      JSON.parse(importText);
      setImportError(null);
      onImport(importText);
      setImportText("");
      onClose();
    } catch {
      setImportError("Invalid JSON format");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setImportText(text);
      setImportError(null);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        role="button"
        tabIndex={0}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === "Escape" || e.key === "Enter") onClose();
        }}
        aria-label="Close dialog"
      />

      <div className="relative w-full max-w-lg mx-4 bg-zinc-950 border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 shadow-inner border border-indigo-500/20">
              <FileJson className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              {mode === "export" ? "Export Machine" : "Import Machine"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800/80 text-zinc-500 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {mode === "export"
            ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="export-json-textarea"
                    className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block"
                  >
                    Raw JSON Payload
                  </label>
                  <textarea
                    readOnly
                    value={exportJson}
                    className="w-full h-64 px-4 py-3 bg-zinc-900/40 border border-zinc-800/80 shadow-inner rounded-xl text-[11px] text-zinc-300 font-mono resize-none focus:outline-none"
                    id="export-json-textarea"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCopy}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-md ${
                      copied
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white"
                    }`}
                    id="copy-export-btn"
                  >
                    {copied
                      ? (
                        <>
                          <Check className="w-4 h-4 shrink-0" />
                          Copied!
                        </>
                      )
                      : (
                        <>
                          <Copy className="w-4 h-4 shrink-0" />
                          Copy to Clipboard
                        </>
                      )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-zinc-800/80 hover:bg-zinc-700 text-white border border-zinc-700 transition-all shadow-sm"
                    id="download-export-btn"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    Download .json
                  </button>
                </div>
              </div>
            )
            : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="import-json-textarea"
                    className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block"
                  >
                    Paste Machine Data
                  </label>
                  <textarea
                    value={importText}
                    onChange={e => {
                      setImportText(e.target.value);
                      setImportError(null);
                    }}
                    placeholder="Paste machine JSON here..."
                    className="w-full h-48 px-4 py-3 bg-zinc-900/40 border border-zinc-800/80 shadow-inner rounded-xl text-[11px] text-zinc-300 font-mono resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-zinc-600"
                    id="import-json-textarea"
                  />
                  {importError && (
                    <p className="text-xs text-red-500 font-medium">
                      {importError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                  <span className="h-px flex-1 bg-zinc-800/80" />
                  or
                  <span className="h-px flex-1 bg-zinc-800/80" />
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-zinc-700 text-sm font-medium text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all"
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  Upload .json file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="pt-2">
                  <button
                    onClick={handleImportSubmit}
                    disabled={!importText.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 transition-all shadow-md"
                    id="import-submit-btn"
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    Import Machine
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
