import React, { useCallback } from "react";
import { Upload, FolderPlus, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone"; // Assuming available, if not I'll use native
import { toast } from "sonner";
import { StudioEngine } from "../../services/studio-engine";

interface UploadZoneProps {
  onUploadComplete: (asset: any) => void;
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const toastId = toast.loading(`Uploading ${file.name}...`);
      
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          
          // Use MCP upload tool via StudioEngine (needs implementation or direct call)
          // For now, let's simulate the asset creation on canvas
          const result = await StudioEngine.generateAsset(`Local: ${file.name}`, { 
            data_base64: base64,
            content_type: file.type
          });

          onUploadComplete({
            id: Math.random().toString(36).substr(2, 9),
            type: "image",
            url: URL.createObjectURL(file),
            name: file.name
          });
          
          toast.success(`${file.name} manifested`, { id: toastId });
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}`, { id: toastId });
      }
    }
  }, [onUploadComplete]);

  return (
    <div className="flex items-center gap-2">
      <label className="p-3 rounded-xl hover:bg-white/10 text-gray-400 hover:text-emerald-neon transition-all cursor-pointer group">
        <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <input 
          type="file" 
          multiple 
          className="hidden" 
          onChange={(e) => {
            if (e.target.files) onDrop(Array.from(e.target.files));
          }}
        />
      </label>
      <button className="p-3 rounded-xl hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-all group" title="Upload Album">
        <FolderPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
}
