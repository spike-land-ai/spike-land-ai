import { useState, useRef, useCallback, type DragEvent } from "react";
import { Upload } from "lucide-react";

interface DropZoneProps {
  onFile: (file: {
    name: string;
    base64: string;
    contentType: string;
    width: number;
    height: number;
  }) => void;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function DropZone({ onFile, accept = "image/*", maxSizeMB = 50, disabled }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError("Only image files are supported.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);

        const img = new Image();
        img.onload = () => {
          const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
          onFile({
            name: file.name,
            base64,
            contentType: file.type,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [maxSizeMB, onFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : dragging
              ? "border-accent-500 bg-accent-500/5"
              : "border-gray-700 hover:border-gray-600 hover:bg-gray-900/50"
        }`}
      >
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <img src={preview} alt="Preview" className="max-h-48 rounded-lg object-contain" />
            <p className="text-sm text-gray-400">Click or drag to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
              <Upload className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-300">
                Drop an image here or click to browse
              </p>
              <p className="text-xs text-gray-500 mt-1">PNG, JPG, WebP up to {maxSizeMB}MB</p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }}
          className="hidden"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
